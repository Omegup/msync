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
import { $eq, $gteTs } from '../predicate'
import { $and } from '../query/logic'
import { aggregate } from '../stream/aggregate'
import type {
  D,
  Iterator,
  Model,
  Frame,
  OutInput,
  RawStages,
  Runner,
  SimpleStreamExecutionResult,
  HasJob,
  Del,
} from '../types'
import type { AggregateCommand } from '../types/aggregate'
import { addTeardown } from '../utils/tear-down'
import { makeWatchStream } from '../watch'

const executes = <Q extends J, T extends doc & Q, Result extends Q, V extends T & Model>(
  view: View<T & D, V>,
  input: RawStages<Q, T, Result, unknown, 1>,
  streamName: string,
): SimpleStreamExecutionResult<Q, Result> => {
  const { collection, projection, hardMatch, match } = view
  const job = {}
  const db = collection.s.db,
    coll = collection.collectionName
  db.command({
    collMod: coll,
    changeStreamPreAndPostImages: { enabled: true },
  })
  const last = db.collection<{ _id: string; ts: Timestamp }>('__last')
  // TODO create indexes (if snapshot is in sources)
  const projectInput = $project_<T & D>({ ...projection, deletedAt: 1 })
  const notDeleted = root<D>().of('deletedAt').has($eq<Timestamp | N>(null))

  const run = <Result2>(
    finalInput: RawStages<unknown, OutInput<Result>, Result2>,
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
    const step0 = (): Next => Promise.resolve(next(step1, 'get last update'))
    const stop: It = withStop(step0)

    // Step 1 : get last update
    const step1 = (): Next =>
      last.findOne({ _id: streamName }).then(ts => next(step4(ts), 'clone into new collection'))

    // Step 4 : run the aggregation // idempotent
    const makeStream = (startAt: Timestamp): ChangeStream => makeWatchStream(db, view, startAt)
    const step4 = (lastTS: { _id: string; ts: Timestamp } | null) => async (): Next => {
      const hardQuery = $and(
        lastTS && root<Model>().of('touchedAt').has($gteTs(lastTS.ts)),
        hardMatch,
      )
      type R = Rec<'item', Arr<T>>
      const replaceRaw: RawStages<unknown, T & D, R & ID> = $replaceWith_(
        field<R & ID, T & D>({
          item: ite($and(notDeleted, match).expr, $array(root<T>().expr()), $array()),
          _id: root<T & D>().of('_id').expr(),
        }),
      )
      const cloneIntoNew = link<V | Del>()
        .with($match_(hardQuery) as RawStages<unknown, V | Del, V>)
        .with(projectInput)
        .with<unknown, R & ID>(replaceRaw)

      type Ctx = RORec<'after', Arr<T>>
      type R2 = Rec<'after', Arr<Result>> & ID
      const aggResult = await aggregate<Result2>(c =>
        c<V | Del, V | Del>({
          coll: collection,
          input: link<V | Del>().stages,
          exec: cloneIntoNew
            .with<unknown, R2>(
              $simpleLookup_<R & ID, Result, null, 'after', Ctx>({
                pipeline: link<null, Ctx>()
                  .with<unknown, T>($documents_(ctx<Arr<T>>()('after').expr()))
                  .with<unknown, Result>(input).stages,
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
  const matcher: RawStages<V | Del, V | Del, V | Del, unknown, 1> = $match_<J, V | Del>(notDeleted)
  const stages = link<V, unknown, 1>()
    .with($match_($and(hardMatch, match)))
    .with(input).stages
  return {
    out: run,
    stages: c =>
      c({
        coll: collection,
        input: matcher as RawStages<V | Del, V | Del, V, unknown, 1>,
        exec: stages,
      }),
  }
}
type J2 = readonly [J, J]
interface StreamRunnerHKT extends HKT<J2> {
  readonly out: SimpleStreamExecutionResult<I<J2, this>[0], I<J2, this>[1]>
}
type J3 = readonly [J, J, J]
interface StagesHKT extends HKT<J3> {
  readonly out: RORec<'lin', RawStages<I<J3, this>[0], I<J3, this>[1], I<J3, this>[2], unknown, 1>>
}

const emptyLin = <V>() => ({ lin: link<V, unknown, 1>().stages })
export const from = <T extends doc, V extends T & Model = T & Model>(
  view: View<T & D, V>,
  streamName: string,
) =>
  pipe<V, V, V, StreamRunnerHKT, StagesHKT>(
    input => executes(view, input.lin, streamName),
    { lin: link<V, unknown, 1>().stages },
    ({ lin: a }, { lin: b }) => ({ lin: concatStages(a, b) }),
    emptyLin,
  )
