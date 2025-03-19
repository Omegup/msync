import crypto from 'crypto'
import { UUID, type ChangeStream, type Timestamp } from 'mongodb'
import type { N, O, O2, O3, OPickD, RORec, StrKey, View } from '../../types'
import type { HKT, I, IdHKT } from '../../types/hkt'
import { $match_, $project_ } from '../aggregate/mongo-stages'
import { concatStages, link, pipe } from '../aggregate/prefix'
import { root } from '../field'
import { $eq, $gteTs } from '../predicate'
import { $expr } from '../predicate/$expr'
import { $and } from '../query/logic'
import { aggregate } from '../stream/aggregate'
import type { Frame, HasJob, Iterator, Query, RawStages, Runner } from '../types'
import type { AggregateCommand } from '../types/aggregate'
import type { Actions, D, Del, Model, SimpleStreamExecutionResult, StreamRunnerParam, TeardownRecord } from '../types/stream'
import { spread } from '../utils/map-object'
import { addTeardown } from '../utils/tear-down'
import { makeWatchStream } from '../watch'
import { actions, type Last, streamNames, type Teardown, type TsData } from './boot'
import { createIndex } from '../utils/db-indexes'
import { log } from '../utils'
import { SynchronousPromise } from 'synchronous-promise'

type Allowed<K> = Exclude<K, 'deletedAt' | '_id'>
type AllowedPick<V extends Model, K extends StrKey<V>> = OPickD<V, Allowed<K>>

const executes = <
  q extends O,
  V extends Model,
  KK extends StrKey<V>,
  Result extends q | AllowedPick<V, KK>,
>(
  view: View<V, Allowed<KK>>,
  input: RawStages<q | AllowedPick<V, KK>, AllowedPick<V, KK>, Result, unknown, 1>,
  streamName: string,
): SimpleStreamExecutionResult<q | AllowedPick<V, KK>, Result> => {
  const hash = crypto
    .createHash('md5')
    .update(new Error().stack + '')
    .digest('base64url')
  if (!streamNames[streamName]) streamNames[streamName] = hash
  else if (streamNames[streamName] != hash) throw new Error('streamName already used')
  type K = Allowed<KK>
  const { collection, projection, hardMatch, match } = view
  const job = {}
  const db = collection.s.db,
    coll = collection.collectionName
  db.command({
    collMod: coll,
    changeStreamPreAndPostImages: { enabled: true },
  })

  createIndex(
    collection,
    { touchedAt: 1 },
    {
      partialFilterExpression: { deletedAt: { $eq: null } },
      name: 'touchedAt_' + new UUID().toString('base64'),
    },
  )
  const last = db.collection<Last>('__last')
  type D_ID = 'deletedAt' | '_id'
  // TODO create indexes (if snapshot is in sources)
  type WithDel = D_ID | Exclude<K, D_ID>
  const projectInput = $project_<V, WithDel>(
    spread<RORec<K, 1>, RORec<D_ID, 1>, IdHKT>(projection, {
      deletedAt: ['deletedAt', 1],
      _id: ['_id', 1],
    }),
  )
  const notDeleted = root<D>().of('deletedAt').has($eq<Timestamp | N>(null))

  const run = <Result2>(
    finalInput: StreamRunnerParam<Result, Result2>,
  ): Runner<readonly Result2[], HasJob> => {
    type W = HasJob & { debug: string }
    type It = Iterator<readonly Result2[], W>
    type FrameD = Frame<readonly Result2[], W>
    type Next = Promise<FrameD>
    const clear = async () => {}
    const withStop = (next: () => PromiseLike<FrameD>, tr?: () => Promise<void>): It => {
      return addTeardown(() => ({ stop, next: next(), clear }), tr)
    }
    const next = (next: () => Next, debug: string, tr?: () => Promise<void>): FrameD => ({
      cont: withStop(next, tr),
      data: [],
      info: { job, debug },
    })


    const data: TsData = {
      input: input,
      finalInputFirst: finalInput.raw(true),
      finalInput: finalInput.raw(false),
      teardown: finalInput.teardown(
        (x): Teardown => ({
          collection: x.collection.collectionName,
          method: x.method,
          params: x.params,
        }),
      ),
    }


    // Step 0 : declare we are starting a job
    const step0 = () => SynchronousPromise.resolve(next(step1, 'get last update'))
    const stop: It = withStop(step0)

    // Step 1 : get last update
    const step1 = (): Next =>
      Promise.all([
        last.findOne({ _id: streamName, data }),
        last.findOne({ _id: streamName }),
      ]).then(ts => next(step2_5(ts), 'handle teardown'))
    const step2_5 =
      ([same, exists]: [Last | null, Last | null]) =>
      async (): Next => {
        const handleTeardown = async <W extends Document, M extends keyof Actions<unknown>>(
          last: Last,
        ) => {
          if(!last.data) return
          const { collection: c, method: m, params: p } = last.data.teardown
          const { collection, method, params } = {
            collection: db.collection<W>(c),
            method: m as M,
            params: p as TeardownRecord<W, M>['params'],
          }
          const [action, out] = actions[method](collection, params)
          log('teardown', ...out)
          await action
          log('teardown done', ...out)
        }
        if (exists && !same) await handleTeardown(exists)
        return next(step4(same), 'clone into new collection')
      }


    type C = Pick<ChangeStream, 'close' | 'tryNext'>
    // Step 4 : run the aggregation // idempotent
    const makeStream = (startAt: Timestamp): C => makeWatchStream(db, view, startAt)
    const step4 = (lastTS: { _id: string; ts: Timestamp } | null) => async (): Next => {
      const hardQuery: Query<V> | undefined = $and(
        lastTS && root<Model>().of('touchedAt').has($gteTs(lastTS.ts)),
        hardMatch,
        notDeleted,
        match && $expr(match),
      )
      const aggResult = await aggregate<Result2>(c =>
        c<V | Del, V | Del>({
          coll: collection,
          input: link<V | Del>()
            .with($match_(hardQuery) as RawStages<unknown, V | Del, V>)
            .with(projectInput)
            .with<unknown, Result>(input)
            .with(finalInput.raw(lastTS === null)).stages,
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
      stream: C
    }

    // Step 7 : update __last
    const step7 = (l: L) => async (): Next => {
      await last.updateOne(
        { _id: streamName },
        { $set: { ts: l.result.cursor.atClusterTime , data } },
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
  return {
    out: run,
  }
}
interface StreamRunnerHKT extends HKT<O2> {
  readonly out: SimpleStreamExecutionResult<I<O2, this>[0], I<O2, this>[1]>
}
interface StagesHKT extends HKT<O3> {
  readonly out: RORec<'lin', RawStages<I<O3, this>[0], I<O3, this>[1], I<O3, this>[2], unknown, 1>>
}

const emptyLin = <V>() => ({ lin: link<V, unknown, 1>().stages })
export const from = <V extends Model, KK extends StrKey<V>>(
  view: View<V, Allowed<KK>>,
  streamName: string,
) =>
  pipe<AllowedPick<V, KK>, AllowedPick<V, KK>, AllowedPick<V, KK>, StreamRunnerHKT, StagesHKT>(
    input => executes(view, input.lin, streamName),
    { lin: link<AllowedPick<V, KK>, unknown, 1>().stages },
    ({ lin: a }, { lin: b }) => ({ lin: concatStages(a, b) }),
    emptyLin,
  )
