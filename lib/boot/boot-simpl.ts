import crypto from 'crypto'
import { UUID, type ChangeStream, type Timestamp } from 'mongodb'
import { SynchronousPromise } from 'synchronous-promise'
import type { N, O, O2, O3, OPickD, RORec, StrKey, View } from '../../types'
import type { ConstHKT, HKT, I, IdHKT } from '../../types/hkt'
import { $match_, $project_ } from '../aggregate/mongo-stages'
import { concatStages, link, pipe } from '../aggregate/prefix'
import { root } from '../field'
import { $eq, $exists, $gteTs } from '../predicate'
import { $expr } from '../predicate/$expr'
import { $and } from '../query/logic'
import { aggregate } from '../stream/aggregate'
import type { Frame, HasJob, Iterator, Query, RawStages, Runner } from '../types'
import type { AggregateCommand } from '../types/aggregate'
import type {
  Actions,
  D,
  Del,
  Model,
  SimpleStreamExecutionResult,
  StreamRunnerParam,
  TeardownRecord,
} from '../types/stream'
import { log } from '../utils'
import { createIndex } from '../utils/db-indexes'
import { mapExactToObject, spread } from '../utils/map-object'
import { addTeardown } from '../utils/tear-down'
import { makeWatchStream } from '../watch'
import { streamNames } from './boot'
import { actions, type Last, type Teardown, type TsData } from './boot-utils'
import { prepare } from '../../test/mongodb'

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
  needs: Partial<Record<KK, 0 | 1>>,
): SimpleStreamExecutionResult<q | AllowedPick<V, KK>, Result> => {
  const hash = crypto
    .createHash('md5')
    .update(new Error().stack + '')
    .digest('base64url')
  if (!streamNames[streamName]) streamNames[streamName] = hash
  else if (streamNames[streamName] != hash) throw new Error('streamName already used')
  type K = Allowed<KK>
  const { collection, projection, hardMatch: pre, match } = view
  const client = prepare()
  const pdb = client.then(cl => cl.db(collection.dbName))

  const removeNotYetSynchronizedFields: null | readonly Query<V>[] =
    projection &&
    Object.values(
      mapExactToObject<RORec<K, 1>, IdHKT, ConstHKT<Query<V> | null>>(projection, (_, k) =>
        (needs[k] ?? k.startsWith('_')) ? root<V>().of(k).has($exists(true)) : null,
      ),
    )
  const hardMatch = removeNotYetSynchronizedFields
    ? $and(pre, ...removeNotYetSynchronizedFields)
    : pre

  const job = {}
  const db = collection.s.db,
    coll = collection.collectionName
  const last = db.collection<Last>('__last')
  type D_ID = 'deletedAt' | '_id'
  // TODO create indexes (if snapshot is in sources)
  type WithDel = D_ID | Exclude<K, D_ID>
  const projectInput =
    projection &&
    $project_<V, WithDel>(
      spread<RORec<K, 1>, RORec<D_ID, 1>, IdHKT>(projection, {
        deletedAt: ['deletedAt', 1],
        _id: ['_id', 1],
      }),
    )
  const notDeleted = root<D>().of('deletedAt').has($eq<Timestamp | N>(null))

  const stages = (lastTS: { _id: string; ts: Timestamp } | null) => {
    const hardQuery: Query<V> | undefined = $and(
      lastTS && root<Model>().of('touchedAt').has($gteTs(lastTS.ts)),
      hardMatch,
      notDeleted,
      match && $expr(match),
    )
    const ln = link<V | Del>().with($match_(hardQuery) as RawStages<unknown, V | Del, V>)
    return (projectInput ? ln.with(projectInput) : ln).with<unknown, Result>(input)
  }

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
      match: view.match?.raw(root()).get(),
      project: projection,
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
    const step1 = async (): Next => {
      log('creating indexes')
      await db.command({
        collMod: coll,
        changeStreamPreAndPostImages: { enabled: true },
      })

      await createIndex(
        collection,
        { touchedAt: 1 },
        {
          partialFilterExpression: { deletedAt: { $eq: null } },
          name: 'touchedAt_' + new UUID().toString('base64'),
        },
      )

      log('start stream', { streamName, data })
      await last.findOne()
      console.log('got last update')
      const p = last.findOne({ _id: streamName, data })
      await p
      log('stream started', { streamName, data })
      const ts = await Promise.all([p, last.findOne({ _id: streamName })])
      log('got last update', { streamName, ts })
      return next(step2_5(ts), 'handle teardown')
    }
    const step2_5 =
      ([same, exists]: [Last | null, Last | null]) =>
      async (): Next => {
        const handleTeardown = async <W extends Document, M extends keyof Actions<unknown>>(
          last: Last,
        ) => {
          if (!last.data) return
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
        return {
          cont: withStop(async () => {
            await new Promise(resolve => setTimeout(resolve, 1000))
            return next(step4(same), 'clone into new collection')
          }),
          data: [],
          info: { debug: 'wait for clone into new collection', job: undefined },
        }
      }

    type C = Pick<ChangeStream<{}, {}>, 'close' | 'tryNext'>
    // Step 4 : run the aggregation // idempotent
    const makeStream = (): Promise<C> => makeWatchStream(view, streamName)
    const step4 = (lastTS: { _id: string; ts: Timestamp } | null) => async (): Next => {
      const raw = stages(lastTS).with(finalInput.raw(lastTS === null)).stages
      const stream = await makeStream()
      // const currTime = await getCurrentTimestamp(db)
      const aggResult = await aggregate<Result2>(pdb, streamName, c =>
        c<V | Del, V | Del>({
          coll: collection,
          input: raw,
        }),
      )

      const nextRes = stream.tryNext()
      
      if (false) {
        const intoColl = (raw.at(-1) as any).$merge.into.coll
        await db
          .collection(intoColl)
          .find({ touchedAt: { $gte: null /* currTime */ } })
          .toArray()
          .then(docs => log(`documents updated ${intoColl}`, docs))
      }

      return next(
        step7({ aggResult, ts: aggResult.cursor.atClusterTime, stream, nextRes }),
        'update __last',
        () => stream.close(),
      )
    }

    type L = {
      aggResult: AggregateCommand<Result2>
      ts: Timestamp
      stream: C
      nextRes: Promise<{} | null>
    }

    // Step 7 : update __last
    const step7 = (l: L) => async (): Next => {
      await last.updateOne({ _id: streamName }, { $set: { ts: l.ts, data } }, { upsert: true })
      return step8(l)
    }
    // Step 8 : wait for change
    const step8 = (l: L): FrameD => {
      return {
        data: l.aggResult.cursor.firstBatch,
        info: { job: undefined, debug: 'wait for change' },
        cont: withStop(() =>
          l.nextRes.then(doc =>
            doc
              ? next(step4({ _id: streamName, ts: l.ts }), 'restart')
              : step8({ ...l, nextRes: l.stream.tryNext() }),
          ),
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
  needs: Partial<Record<KK, 0 | 1>> = {},
) =>
  pipe<AllowedPick<V, KK>, AllowedPick<V, KK>, AllowedPick<V, KK>, StreamRunnerHKT, StagesHKT>(
    input => executes(view, input.lin, streamName, needs),
    { lin: link<AllowedPick<V, KK>, unknown, 1>().stages },
    ({ lin: a }, { lin: b }) => ({ lin: concatStages(a, b) }),
    emptyLin,
  )
