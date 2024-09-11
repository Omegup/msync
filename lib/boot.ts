import type { ChangeStream, Timestamp } from 'mongodb'
import type { J, N, O, View, doc } from '../types'
import { $match_, $merge_, $project_, $replaceWith_, $set_ } from './aggregate/mongo-stages'
import { concatStages, emptyDelta, link, pipe } from './aggregate/prefix'
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
  NextData,
  Query,
  RawStages,
  Runner,
  SnapshotStreamExecutionResult,
  UDelta,
  Working,
} from './types'
import type { AggregateCommand } from './types/aggregate'
import { set, to } from './update'
import { asBefore } from './utils/before'
import { makeWatchStream } from './watch'
import { addTeardown } from './utils/tear-down'

type D = O<{ deletedAt: Timestamp | undefined; _id: string }>
export type TS = D & { touchedAt: Timestamp }

const executes = <T extends doc, Result extends J, V extends T & TS>(
  view: View<T & D, V>,
  input: DeltaStages<T, Result>,
  streamName: string,
): SnapshotStreamExecutionResult<Result> => {
  const { collection, projection, hardMatch, match } = view
  const work = {}
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
    type W = Working & { debug: string }
    type It = Iterator<readonly Result2[], W>
    type NextD = NextData<readonly Result2[], W>
    type Next = Promise<NextD>
    const withStop = (next: () => Next, tr?: () => void): It => {
      return addTeardown(() => ({ stop, next: next() }), tr)
    }
    const next = (next: () => Next, debug: string, tr?: () => void): NextD => ({
      cont: withStop(next, tr),
      data: [],
      info: { work, debug },
    })

    // Step 0 : declare we are starting a work
    const step0 = (): Next => Promise.resolve(next(step1, 'empty new collection'))
    const stop: It = withStop(step0)

    // Step 1 : empty new collection
    const step1 = (): Next =>
      snapshotCollection.deleteMany({ updated: true }).then(() => next(step2, 'get last update'))

    // Step 2 : get last update
    const step2 = (): Next =>
      last.findOne({ _id: streamName }).then(ts => next(step3(ts), 'clone into new collection'))

    // Step 3 : clone into new collection
    const step3 = (lastTS: { _id: string; ts: Timestamp } | null) => async (): Next => {
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

      const r = await aggregate<T>(c => c({ coll: collection, stages: cloneIntoNew }))
      return next(step4(r), 'run the aggregation')
    }

    // Step 4 : run the aggregation // idempotent
    const makeStream = (startAt: Timestamp): ChangeStream => makeWatchStream(db, view, startAt)
    const step4 = (result: AggregateCommand<T>) => async (): Next => {
      const aggResult = await aggregate<Result2>(c =>
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
      )
      const stream = makeStream(result.cursor.atClusterTime)
      return next(step5({ result, aggResult, stream }), 'remove handled deleted updated', () =>
        stream.close(),
      )
    }

    // Step 5 : remove handled deleted updated
    const step5 = (l: L) => async (): Next => {
      await snapshotCollection.deleteMany({ updated: true, after: null })
      return next(step6(l), 'update snapshot aggregation')
    }
    type L = {
      aggResult: AggregateCommand<Result2>
      result: AggregateCommand<T>
      stream: ChangeStream
    }

    // Step 6 : update snapshot aggregation
    const step6 = (l: L) => async (): Next => {
      await snapshotCollection.updateMany({ updated: true }, [
        {
          $set: {
            updated: false,
            after: null,
            before: '$after',
          },
        },
      ])
      return next(step7(l), 'update __last')
    }

    // Step 7 : update __last
    const step7 = (l: L) => async (): Next => {
      await last.updateOne(
        { _id: streamName },
        { $set: { ts: l.result.cursor.atClusterTime } },
        { upsert: true },
      )
      return step8(l)
    }
    // Step 8 : wait for change
    const step8 = (l: L): NextD => {
      return {
        data: l.aggResult.cursor.firstBatch,
        info: { work: undefined, debug: 'wait for change' },
        cont: withStop(() =>
          l.stream.tryNext().then(doc => (doc ? next(step1, 'restart') : step8(l))),
        ),
      }
    }
    return stop
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

export const from = <T extends doc, V extends T & TS>(view: View<T & D, V>, streamName: string) =>
  pipe<V, V>(input => executes(view, input, streamName), emptyDelta())
