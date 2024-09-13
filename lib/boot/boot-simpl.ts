import type { ChangeStream, Timestamp } from 'mongodb'
import type { Arr, HKT, I, ID, J, N, O, RORec, Rec, View, doc } from '../../types'
import {
  $documents_,
  $match_,
  $project_,
  $replaceWith_,
  $simpleLookup_,
} from '../aggregate/mongo-stages'
import { concatStages, link, pipe } from '../aggregate/prefix'
import { $array, $first } from '../expression/array'
import { field } from '../expression/concat'
import { $ifNull, ite } from '../expression/logic'
import { val } from '../expression/val'
import { ctx, root } from '../field'
import { $gteTs, $ne } from '../predicate'
import { $and } from '../query/logic'
import { aggregate } from '../stream/aggregate'
import type {
  Iterator,
  NextData,
  OutInput,
  RawStages,
  Runner,
  StreamRunner,
  Working,
} from '../types'
import type { AggregateCommand } from '../types/aggregate'
import { addTeardown } from '../utils/tear-down'
import { makeWatchStream } from '../watch'

type D = O<{ deletedAt: Timestamp | undefined; _id: string }>
export type TS = D & { touchedAt: Timestamp }

const executes = <T extends doc, Result extends J, V extends T & TS>(
  view: View<T & D, V>,
  input: RawStages<T, Result, unknown, 1>,
  streamName: string,
): StreamRunner<OutInput<Result>> => {
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
    finalInput: RawStages<OutInput<Result>, Result2>,
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
      type R = Rec<'item', Arr<T>>
      const replaceRaw: RawStages<T & D, R & ID> = $replaceWith_(
        field<R & ID, T & D>({
          item: ite($and(notDeleted, match).expr, $array(root<T>().expr()), $array()),
          _id: root<T & D>().of('_id').expr(),
        }),
      )
      const cloneIntoNew = link<V>()
        .with($match_(hardQuery))
        .with(projectInput)
        .with<R & ID>(replaceRaw)

      type Ctx = RORec<'after', Arr<T>>
      type R2 = Rec<'after', Arr<Result>> & ID

      const aggResult = await aggregate<Result2>(c =>
        c<V>({
          coll: collection,
          stages: cloneIntoNew
            .with<R2>(
              $simpleLookup_<R & ID, Result, null, 'after', Ctx>({
                pipeline: link<null, Ctx>()
                  .with<T>($documents_(ctx<Arr<T>>()('after').expr()))
                  .with<Result>(input).stages,
                k: 'after',
                vars: { after: root<R>().of('item').expr() },
              }),
            )
            .with(
              $replaceWith_<R2, OutInput<Result>>(
                field({
                  after: $ifNull($first(root<R2>().of('after').expr()), val(null)),
                  before: field<O<ID>, R2>({ _id: root<R2>().of('_id').expr() }),
                }),
              ),
            )
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
  readonly out: StreamRunner<OutInput<I<J, this>>>
}
type J2 = readonly [J, J]
interface StagesHKT extends HKT<J2> {
  readonly out: RawStages<I<J2, this>[0], I<J2, this>[1], unknown, 1>
}

export const from = <T extends doc, V extends T & TS>(view: View<T & D, V>, streamName: string) =>
  pipe<V, V, StreamRunnerHKT, StagesHKT>(
    input => executes(view, input, streamName),
    link<V, unknown, 1>().stages,
    concatStages,
  )
