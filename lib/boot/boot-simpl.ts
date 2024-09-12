import type { ChangeStream, Timestamp } from 'mongodb'
import type { HKT, I, ID, J, N, O, View, doc } from '../../types'
import { $match_, $project_, $replaceWith_, $set_ } from '../aggregate/mongo-stages'
import { emptyDelta, link, pipe } from '../aggregate/prefix'
import { field } from '../expression/concat'
import { $ifNull, ite } from '../expression/logic'
import { nil, val } from '../expression/val'
import { root } from '../field'
import { $gteTs, $ne } from '../predicate'
import { $and } from '../query/logic'
import { aggregate } from '../stream/aggregate'
import type {
  Delta,
  DeltaStages,
  Iterator,
  NextData,
  RawStages,
  Runner,
  SnapshotStreamExecutionResult,
  StreamRunner,
  UDelta,
  Working,
} from '../types'
import type { AggregateCommand } from '../types/aggregate'
import { set, to } from '../update'
import { addTeardown } from '../utils/tear-down'
import { makeWatchStream } from '../watch'

type D = O<{ deletedAt: Timestamp | undefined; _id: string }>
export type TS = D & { touchedAt: Timestamp }

const executes = <T extends doc, Result extends J, V extends T & TS>(
  view: View<T & D, V>,
  input: DeltaStages<T, Result>,
  streamName: string,
): SnapshotStreamExecutionResult<Result>['run'] => {
  const { collection, projection, hardMatch, match } = view
  const work = {}
  const db = collection.s.db,
    coll = collection.collectionName
  db.command({
    collMod: coll,
    changeStreamPreAndPostImages: { enabled: true },
  })
  const last = db.collection<{ _id: string; ts: Timestamp }>('__last')
  // TODO create indexes (if snapshot is in sources)
  const projectInput = $project_<T & D>({ ...projection, deletedAt: 1 })

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
    const step0 = (): Next => Promise.resolve(next(step1, 'get last update'))
    const stop: It = withStop(step0)

    // Step 1 : get last update
    const step1 = (): Next =>
      last.findOne({ _id: streamName }).then(ts => next(step4(ts), 'clone into new collection'))

    // Step 4 : run the aggregation // idempotent
    const makeStream = (startAt: Timestamp): ChangeStream => makeWatchStream(db, view, startAt)
    const step4 = (lastTS: { _id: string; ts: Timestamp } | null) => async (): Next => {
      const hardQuery = $and(lastTS && root<TS>().of('touchedAt').has($gteTs(lastTS.ts)), hardMatch)
      const notDeleted = root<D>().of('deletedAt').has($ne<Timestamp | N>(null))
      type R = UDelta<T, {}>
      const replaceRaw: RawStages<T & D, R & ID> = $replaceWith_(
        field<Delta<T | null, 'after', ID>, T & D>({
          after: ite($and(notDeleted, match).expr, root<T>().expr(), val(null)),
          _id: root<T & D>().of('_id').expr(),
        }),
      )
      const cloneIntoNew = link<V>()
        .with($match_(hardQuery))
        .with(projectInput)
        .with<R & ID>(replaceRaw)

      const aggResult = await aggregate<Result2>(c =>
        c<V>({
          coll: collection,
          stages: cloneIntoNew
            .with(
              $set_<UDelta<T, {}>, Delta<T>>(
                set({
                  before: to($ifNull(root<R>().of('before').expr(), nil)),
                }),
              ),
            )
            .with(input.delta)
            .with(finalInput).stages,
        }),
      )
      const stream = makeStream(aggResult.cursor.atClusterTime)
      return next(step7({ aggResult, result: aggResult, stream }), 'update __last', () =>
        stream.close(),
      )
    }

    type L = {
      aggResult: AggregateCommand<Result2>
      result: AggregateCommand<Result2>
      stream: ChangeStream
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
  return run
}
interface StreamRunnerHKT extends HKT<J> {
  readonly out: StreamRunner<I<J, this>>
}

export const from = <T extends doc, V extends T & TS>(view: View<T & D, V>, streamName: string) =>
  pipe<V, V, StreamRunnerHKT>(input => executes(view, input, streamName), emptyDelta())
