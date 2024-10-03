import type { ChangeStream, Timestamp } from 'mongodb'
import type { HKT, I, J, J2, J3, N, View, doc } from '../../types'
import { $match_, $project_, $replaceWith_, $set_ } from '../aggregate/mongo-stages'
import { $merge_ } from '../aggregate/out'
import { concatDelta, emptyDelta, link, pipe } from '../aggregate/prefix'
import { field } from '../expression/concat'
import { $ifNull, ite } from '../expression/logic'
import { nil, val } from '../expression/val'
import { root } from '../field'
import { $eq, $gteTs, $ne } from '../predicate'
import { $and } from '../query/logic'
import { aggregate } from '../stream/aggregate'
import type { AggregateCommand, Before, SnapshotStreamExecutionResult } from '../types'
import type { Frame, HasJob, Iterator, Runner } from '../types/machine'
import type { After, D, Del, Delta, DeltaStages, Model, RawStages, UDelta } from '../types/stream'
import { set, to } from '../update'
import { asBefore } from '../utils/before'
import { addTeardown } from '../utils/tear-down'
import { makeWatchStream } from '../watch'
import { log } from '../utils/log'

const executes = <Q extends J, T extends doc & Q, Result extends Q, V extends T & Model>(
  view: View<T & D, V>,
  input: DeltaStages<Q, T, Result>,
  streamName: string,
): SnapshotStreamExecutionResult<Q, Result> => {
  const { collection, projection, hardMatch, match } = view
  const job = {}
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

  const run = <Result2>(
    finalInput: RawStages<unknown, Delta<Result>, Result2>,
  ): Runner<readonly Result2[], HasJob> => {
    type W = HasJob & { debug: string }
    type It = Iterator<readonly Result2[], W>
    type FrameD = Frame<readonly Result2[], W>
    type Next = Promise<FrameD>
    const withStop = (next: () => Next, tr?: () => void): It => {
      return addTeardown(() => ({ stop, next: next() }), tr)
    }
    const next = (next: () => Next, debug: string, tr?: () => void): FrameD => ({
      cont: withStop(next, tr),
      data: [],
      info: { job, debug },
    })

    // Step 0 : declare we are starting a job
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
      const hardQuery = $and(
        lastTS && root<Model>().of('touchedAt').has($gteTs(lastTS.ts)),
        hardMatch,
      )
      const notDeleted = root<D>().of('deletedAt').has($eq<Timestamp | N>(null))
      const replaceRaw: RawStages<J, T & D, After<T> & { updated: true; _id: string }> =
        $replaceWith_(
          field<After<T> & { updated: true; _id: string }, T & D>({
            after: ite($and(notDeleted, match).expr, root<T>().expr(), val(null)),
            updated: val(true),
            _id: root<T & D>().of('_id').expr(),
          }),
        )
      const cloneIntoNew = link<V>()
        .with(projectInput)
        .with(replaceRaw)
        .with($merge_({ into: snapshotCollection, on: root<UDelta<T>>().of('_id') })).stages

      const r = await aggregate<'out'>(c =>
        c({
          coll: collection,
          input: $match_(hardQuery) as RawStages<J, V | Del, V>,
          exec: cloneIntoNew,
        }),
      )
      return next(step4(r), 'run the aggregation')
    }

    // Step 4 : run the aggregation // idempotent
    const makeStream = (startAt: Timestamp): ChangeStream => makeWatchStream(db, view, startAt)
    const step4 = (result: AggregateCommand<'out'>) => async (): Next => {
      const aggResult = await aggregate<Result2>(c =>
        c<UDelta<T>, UDelta<T>>({
          coll: snapshotCollection,
          input: link<UDelta<T>>().stages,
          exec: link<UDelta<T>>()
            .with($match_(root<UDelta<T>>().of('updated').has($eq<boolean>(true))))
            .with(
              $set_<UDelta<T>, UDelta<T>, UDelta<T> & Delta<T>>(
                set({
                  before: to($ifNull(root<UDelta<T>>().of('before').expr(), nil)),
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
      log('remove handled deleted updated')
      await snapshotCollection.deleteMany({ updated: true, after: null })
      log('removed handled deleted updated')
      return next(step6(l), 'update snapshot aggregation')
    }
    type L = {
      aggResult: AggregateCommand<Result2>
      result: AggregateCommand<'out'>
      stream: ChangeStream
    }

    // Step 6 : update snapshot aggregation
    const step6 = (l: L) => async (): Next => {
      log('update snapshot aggregation')
      await snapshotCollection.updateMany({ updated: true }, [
        {
          $set: {
            updated: false,
            after: null,
            before: '$after',
          },
        },
      ])
      log('updated snapshot aggregation')
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
    const step8 = (l: L): FrameD => {
      return {
        data: l.aggResult.cursor.firstBatch,
        info: { job: undefined, debug: 'wait for change' },
        cont: withStop(() =>
          l.stream.tryNext().then(doc => (doc ? next(step1, 'restart') : step8(l))),
        ),
      }
    }
    return stop
  }
  const hasBefore = root<UDelta<T>>().of('before').has($ne<T | N>(null))
  return {
    stages: c =>
      c<UDelta<T>, Before<T>>({
        coll: snapshotCollection,
        input: $match_(hasBefore) as RawStages<unknown, UDelta<T>, Before<T>>,
        exec: asBefore(input.raw),
      }),
    out: run,
  }
}

export interface SnapshotStreamHKT extends HKT<J2> {
  readonly out: SnapshotStreamExecutionResult<I<J2, this>[0], I<J2, this>[1]>
}
export interface DeltaHKT extends HKT<J3> {
  readonly out: DeltaStages<I<J3, this>[0], I<J3, this>[1], I<J3, this>[2]>
}

export const staging = <T extends doc, V extends T & Model = T & Model>(
  view: View<T & D, V>,
  streamName: string,
) =>
  pipe<V, V, V, SnapshotStreamHKT, DeltaHKT>(
    input => executes(view, input, streamName),
    emptyDelta(),
    concatDelta,
    emptyDelta,
  )
