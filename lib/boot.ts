import type { ChangeStream, Timestamp } from 'mongodb'
import type { J, N, O, View, doc } from '../types'
import { $match_, $merge_, $project_, $replaceWith_, $set_ } from './aggregate/mongo-stages'
import { concatStages, link } from './aggregate/prefix'
import { field } from './expression/concat'
import { $ifNull, ite } from './expression/logic'
import { nil, val } from './expression/val'
import { root } from './field'
import { $eq, $gteTs, $ne } from './predicate'
import { $and } from './query/logic'
import { aggregate } from './stream/aggregate'
import type {
  After,
  Before,
  Delta,
  DeltaStages,
  Iterator,
  Query,
  RawStages,
  Runner,
  SnapshotStream,
  SnapshotStreamExecutionResult,
  UDelta,
  Working,
} from './types'
import type { AggregateCommand } from './types/aggregate'
import { set, to } from './update'
import { asBefore } from './utils/before'
import { makeWatchStream } from './watch'

type D = O<{ deletedAt: Timestamp | undefined; _id: string }>
export type TS = D & { touchedAt: Timestamp }

const executes = <T extends doc, Result extends J, V extends T & TS>(
  view: View<T & D, V>,
  input: DeltaStages<T, Result>,
  streamName: string,
): SnapshotStreamExecutionResult<Result> => {
  const { collection, projection, hardMatch, match } = view
  const db = collection.s.db,
    coll = collection.collectionName
  db.command({
    collMod: coll,
    changeStreamPreAndPostImages: { enabled: true },
  })
  const last = db.collection<{ _id: string; ts: Timestamp }>('__last')
  const snapshotCollection = db.collection<UDelta<T>>(coll + '_' + streamName + '_snapshot')
  // TODO create indexes (if snapshot is in sources)
  const projectInput = $project_<T & D>({ ...projection, deletedAt: 1 })

  const isNew = (isNew: boolean): Query<UDelta<T>> =>
    root<UDelta<T>>().of('updated').has($eq<boolean>(isNew))

  const run = <Result2 extends J>(
    finalInput: RawStages<Delta<Result>, Result2>,
  ): Runner<readonly Result2[], Working> => {
    const work = <T>(x: Promise<T>, work: true | undefined) => x.then(data => ({ data, work }))
    type It = Iterator<readonly Result2[], Working>
    // Step 0 : declare we are starting a work
    const step0 = (): It => c =>
      c({
        ...d,
        next: work(Promise.resolve(), true),
        cont: step1,
      })
    const d = { data: [], stop: step0 }
    // Step 1 : empty new collection
    const step1 = (): It => c =>
      c({
        ...d,
        next: work(snapshotCollection.deleteMany({ updated: true }), true),
        cont: step2,
      })

    // Step 2 : get last update
    const step2 = (): It => c =>
      c({
        ...d,
        next: work(last.findOne({ _id: streamName }), true),
        cont: step3,
      })
    // Step 3 : clone into new collection
    const step3 = ({ data: lastTS }: { data: { _id: string; ts: Timestamp } | null }): It => {
      const hardQuery = $and(lastTS && root<TS>().of('touchedAt').has($gteTs(lastTS.ts)), hardMatch)
      const notDeleted = root<D>().of('deletedAt').has($ne<Timestamp | N>(null))
      const replaceRaw: RawStages<T & D, After<T> & { updated: true; _id: string }> = $replaceWith_(
        field<After<T> & { updated: true; _id: string }, T & D>({
          after: ite($and(notDeleted, match).expr, root<T>().expr(), val(null)),
          updated: val(true),
          _id: root<T & D>().of('_id').expr(),
        }),
      )
      const cloneIntoNew = link<V>()
        .with($match_(hardQuery))
        .with(projectInput)
        .with(replaceRaw)
        .with($merge_({ into: snapshotCollection, on: root<UDelta<T>>().of('_id') })).stages
      const next = work(
        aggregate<T>(c => c({ coll: collection, stages: cloneIntoNew })),
        true,
      )

      return c =>
        c({
          ...d,
          next,
          cont: step4,
        })
    }

    const makeStream = (startAt: Timestamp): ChangeStream => makeWatchStream(db, view, startAt)
    // Step 4 : run the aggregation // idempotent

    const step4 =
      ({ data: result }: { data: AggregateCommand<T> }): It =>
      c =>
        c({
          ...d,
          next: work(
            aggregate<Result2>(c =>
              c<UDelta<T>>({
                coll: snapshotCollection,
                stages: link<UDelta<T>>()
                  .with($match_(isNew(true)))
                  .with(
                    $set_<UDelta<T>, UDelta<T> & Delta<T>>(
                      set({
                        before: to($ifNull(root<UDelta<T>>().of('before').expr(), nil)),
                        after: to($ifNull(root<UDelta<T>>().of('after').expr(), nil)),
                      }),
                    ),
                  )
                  .with(input.delta)
                  .with(finalInput).stages,
              }),
            ),
            true,
          ).then(x => ({ ...x, stream: makeStream(result.cursor.atClusterTime) })),
          cont: step5(result),
        })
    // Step 5 : remove handled deleted updated
    const step5 =
      (result: AggregateCommand<T>) =>
      ({
        data: aggResult,
        stream,
      }: {
        data: AggregateCommand<Result2>
        stream: ChangeStream
      }): It => {
        return c =>
          c({
            ...d,
            next: work(snapshotCollection.deleteMany({ updated: true, after: null }), true),
            cont: step6({ aggResult, result, stream }),
          })
      }
    type L = {
      aggResult: AggregateCommand<Result2>
      result: AggregateCommand<T>
      stream: ChangeStream
    }
    // Step 6 : update snapshot aggregation
    const step6 = (l: L) => (): It => c =>
      c({
        ...d,
        next: work(
          snapshotCollection.updateMany({ updated: true }, [
            {
              $set: {
                updated: false,
                after: null,
                before: '$after',
              },
            },
          ]),
          true,
        ),
        cont: step7(l),
      })
    // Step 7 : update __last
    const step7 = (l: L) => (): It => c =>
      c({
        ...d,
        next: work(
          last.updateOne(
            { _id: streamName },
            { $set: { ts: l.result.cursor.atClusterTime } },
            { upsert: true },
          ),
          true,
        ),
        cont: step8(l),
      })

    const step8 = (l: L) => (): It => {
      const stop = () => {
        l.stream.close()
        return step0()
      }
      return c =>
        c({
          stop,
          data: l.aggResult.cursor.firstBatch,
          next: work(l.stream.tryNext(), undefined),
          cont: ({ data: doc }) => {
            return doc ? stop() : step8(l)()
          },
        })
    }

    return step0()
  }
  return {
    stages: c =>
      c({
        coll: snapshotCollection,
        stages: concatStages(
          $match_(isNew(false)) as RawStages<UDelta<T>, Before<T>>,
          asBefore(input.raw),
        ),
      }),
    run,
  }
}

type Params<T extends doc, V extends T & TS & J> = readonly [
  view: View<T & D, V>,
  streamName: string,
]

export const from =
  <T extends doc, V extends T & TS>(...[view, streamName]: Params<T, V>): SnapshotStream<T> =>
  input =>
    executes(view, input, streamName)
