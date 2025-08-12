import crypto from 'crypto'
import { Collection, UUID, type ChangeStream, type Timestamp } from 'mongodb'
import { SynchronousPromise } from 'synchronous-promise'
import type { N, O, O2, O3, StrKey, View } from '../../types'
import type { HKT, I } from '../../types/hkt'
import { $match_, $replaceWith_ } from '../aggregate/mongo-stages'
import { $merge_ } from '../aggregate/out'
import { concatDelta, emptyDelta, link, pipe, type DeltaPipe } from '../aggregate/prefix'
import { mergeObjects } from '../expression'
import { field } from '../expression/concat'
import { $ifNull, and, eq, ite, ne } from '../expression/logic'
import { nil, val } from '../expression/val'
import { ctx, root } from '../field'
import { $eq, $ne } from '../predicate'
import { $expr } from '../predicate/$expr'
import { aggregate } from '../stream/aggregate'
import type { AggregateCommand, Before, Expr, SnapshotStreamExecutionResult } from '../types'
import type { Frame, HasJob, Iterator, Runner } from '../types/machine'
import type {
  Actions,
  After,
  D,
  Delta,
  DeltaStages,
  Model,
  RawStages,
  StreamRunnerParam,
  TeardownRecord,
  UDelta,
} from '../types/stream'
import { noop } from '../utils'
import { asBefore } from '../utils/before'
import { createIndex } from '../utils/db-indexes'
import { log } from '../utils/log'
import { addTeardown } from '../utils/tear-down'
import { makeWatchStream } from '../watch'
import type { Allowed, AllowedPick, Last, Teardown, TsData } from './boot-utils'
import { actions } from './boot-utils'
import { getFirstStages } from './first-stages'

export const streamNames: Record<string, string> = {}
const executes = <
  q extends O,
  V extends Model,
  KK extends StrKey<V>,
  Result extends q | AllowedPick<V, KK>,
>(
  view: View<V, Allowed<KK>>,
  input: DeltaStages<q | AllowedPick<V, KK>, AllowedPick<V, KK>, Result>,
  streamName: string,
  skip = false,
  after?: () => Promise<void>,
): SnapshotStreamExecutionResult<q | AllowedPick<V, KK>, Result> => {
  type T = AllowedPick<V, KK>

  const { collection, projection, match } = view

  const { firstStages, hardMatch } = getFirstStages(view)

  const db = collection.s.db,
    coll = collection.collectionName

  const hash = crypto
    .createHash('md5')
    .update(new Error().stack + '')
    .digest('base64url')
  if (!streamNames[streamName]) streamNames[streamName] = hash
  else if (streamNames[streamName] != hash) throw new Error(`streamName ${streamName} already used`)
  db.command({
    collMod: coll,
    changeStreamPreAndPostImages: { enabled: true },
  })
  createIndex(
    collection,
    { touchedAt: 1 },
    hardMatch
      ? {
          partialFilterExpression: hardMatch.raw(root()),
          name: 'touchedAt_hard_' + new UUID().toString('base64'),
        }
      : {},
  ).catch(e => e.code == 86 || Promise.reject(e))

  const last = db.collection<Last>('__last')
  const snapshotCollection = db.collection<UDelta<T>>(coll + '_' + streamName + '_snapshot')

  createIndex(
    snapshotCollection,
    { updated: 1 },
    {
      partialFilterExpression: { updated: true },
      name: 'updated_' + new UUID().toString('base64'),
    },
  )

  createIndex(
    snapshotCollection,
    { updated: 1 },
    {
      partialFilterExpression: { updated: true, after: null, before: null },
      name: 'updated_nulls_' + new UUID().toString('base64'),
    },
  )

  const job = {}
  const run = <Result2>(
    finalInput: StreamRunnerParam<Delta<Result>, Result2>,
  ): Runner<readonly Result2[], HasJob> => {
    type W = HasJob & { debug: string }
    type It = Iterator<readonly Result2[], W>
    type FrameD = Frame<readonly Result2[], W>
    type Next = Promise<FrameD>
    const clear = async () =>
      Promise.all([
        snapshotCollection.drop().catch(noop).catch(noop),
        last.deleteOne({ _id: streamName }),
      ])

    const withStop = (next: () => PromiseLike<FrameD>, tr?: () => Promise<void>): It => {
      return addTeardown(() => ({ stop, next: next(), clear }), tr)
    }
    const nextData =
      (data: readonly Result2[], job?: object) =>
      (next: () => Next, debug: string, tr?: () => Promise<void>): FrameD => ({
        cont: withStop(next, tr),
        data,
        info: { job, debug: `${streamName} on ${collection.collectionName}: ${debug}` },
      })
    const next = nextData([], job)

    const data: TsData = {
      input: input.delta,
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
    const step0 = () => SynchronousPromise.resolve(next(step1, 'empty new collection'))
    const stop: It = withStop(step0)

    // Step 1 : empty new collection
    const step1 = async (): Next => {
      await snapshotCollection.updateMany(
        { updated: true },
        { $set: { updated: false, after: null } },
      )
      // we don't need to remove null before because they will be reinserted anyway in step 3
      return next(step2, 'get last update')
    }
    // Step 2 : get last update
    const step2 = (): Next =>
      Promise.all([
        last.findOne({ _id: streamName, data }),
        last.findOne({ _id: streamName }),
      ]).then(ts =>
        next(
          step2_5(ts),
          ts[0]
            ? `no teardown to handle, starting at ${ts[0].ts}`
            : ts[1]
              ? 'handle teardown'
              : 'start fresh',
        ),
      )
    const step2_5 =
      ([same, exists]: [Last | null, Last | null]) =>
      async (): Next => {
        const handleTeardown = async <W extends Document, M extends keyof Actions<unknown>>(
          last: Pick<Last, 'data'>,
        ) => {
          if (!last.data) return
          const { collection: c, method: m, params: p } = last.data.teardown
          const { collection, method, params } = {
            collection: db.collection<W>(c),
            method: m as M,
            params: p as TeardownRecord<W, M>['params'],
          }
          const [action, out] = actions[method](collection, params)
          log('teardown', `db['${snapshotCollection.collectionName}'].drop()`, ...out)
          await Promise.all([snapshotCollection.drop().catch(noop), action])
          log('teardown done', `db['${snapshotCollection.collectionName}'].drop()`, ...out)
        }
        if (!same) {
          await handleTeardown(exists ?? { data })
        }
        await after?.()
        return nextData([])(async () => {
          // @TODO: use a proper way to execute teardowns before streams
          await new Promise(resolve => setTimeout(resolve, 1000))
          return step3(same)()
        }, 'clone into new collection')
      }

    // Step 3 : clone into new collection
    const step3 = (lastTS: { _id: string; ts: Timestamp } | null) => async (): Next => {
      const notDeleted: Expr<boolean, T, unknown> = eq(
        $ifNull(root<D>().of('deletedAt').expr(), nil),
      )(nil)
      const query = match ? and<T & D>(notDeleted, match) : notDeleted
      type ToMerge = After<T> & { updated: true; _id: string }
      const replaceRaw: RawStages<O, T & D, ToMerge> = $replaceWith_(
        field<ToMerge, T & D>({
          after: ['after', lastTS ? ite(query, root<T>().expr(), nil) : root<T>().expr()],
          updated: ['updated', val(true)],
          _id: ['_id', root<T & D>().of('_id').expr()],
        }),
      )

      const cloneIntoNew = firstStages(lastTS)
        .with(replaceRaw)
        .with(
          $merge_<ToMerge, UDelta<T>, { new: ToMerge }>({
            into: snapshotCollection,
            on: root<UDelta<T>>().of('_id'),
            stages: 'ctx',
            vars: {
              new: ['new', root<ToMerge>().expr()],
            },
            whenMatched: link<UDelta<T>, { new: ToMerge }>().with(
              $replaceWith_(
                ite(
                  eq<T | N, UDelta<T>, { new: ToMerge }>(root<UDelta<T>>().of('before').expr())(
                    ctx<ToMerge>()('new').of('after').expr(),
                  ),
                  root<UDelta<T>>().expr(),
                  mergeObjects(root<UDelta<T>>().expr(), ctx<ToMerge>()('new').expr()),
                ),
              ),
            ).stages,
            whenNotMatched: 'insert',
          }),
        ).stages

      const r = await aggregate<'out'>(streamName, c =>
        c({ coll: collection, input: cloneIntoNew }),
      )
      await snapshotCollection.deleteMany({ updated: true, after: null, before: null })
      return next(step4({ result: r, ts: lastTS?.ts }), 'run the aggregation')
    }

    type Res = {}
    type C = Pick<ChangeStream<{}, Res>, 'close' | 'tryNext'>

    // Step 4 : run the aggregation // idempotent
    const makeStream = (startAt: Timestamp): C => makeWatchStream(db, view, startAt, streamName)
    const step4 =
      ({ result, ts }: { result: AggregateCommand<'out'>; ts?: Timestamp }) =>
      async (): Next => {
        const start = Date.now()
        await snapshotCollection.updateMany({ before: null }, { $set: { before: null } })
        const aggResult = await aggregate<Result2>(
          streamName,
          c =>
            c<UDelta<T>, UDelta<T> & Delta<T>>({
              coll: snapshotCollection as Collection<UDelta<T> & Delta<T>>,
              input: link<UDelta<T> & Delta<T>>()
                .with($match_(root<UDelta<T> & Delta<T>>().of('updated').has($eq<boolean>(true))))
                .with(
                  $match_(
                    $expr(
                      ne(root<UDelta<T> & Delta<T>>().of('after').expr())(
                        root<UDelta<T> & Delta<T>>().of('before').expr(),
                      ),
                    ),
                  ),
                )
                .with(input.delta)
                .with(finalInput.raw(ts === undefined)).stages,
            }),
          false,
          start,
        )
        const stream = makeStream(result.cursor.atClusterTime)
        return next(
          step5({ ts: result.cursor.atClusterTime, aggResult, stream }),
          'remove handled deleted updated',
          () => stream.close(),
        )
      }

    // Step 5 : remove handled deleted updated
    const step5 = (l: L) => async (): Next => {
      log(
        `remove handled deleted updated db['${snapshotCollection.collectionName}'].deleteMany({ updated: true, after: null })`,
      )
      await snapshotCollection.deleteMany({ updated: true, after: null })
      log('removed handled deleted updated')
      return next(step6(l), 'update snapshot aggregation')
    }
    type L = {
      aggResult: AggregateCommand<Result2>
      ts: Timestamp
      stream: C
    }

    // Step 6 : commit changes on snapshot
    const step6 = (l: L) => async (): Next => {
      log(
        'update snapshot aggregation',
        `db['${snapshotCollection.collectionName}'].updateMany({ updated: true }, [ { $set: { updated: false, after: null, before: '$after' } } ])`,
      )
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
        {
          $set: {
            ts: l.ts,
            data,
          },
        },
        { upsert: true },
      )
      return step8(l)
    }
    // Step 8 : wait for change
    const step8 = (l: L): FrameD => {
      return nextData(l.aggResult.cursor.firstBatch)(
        () =>
          l.stream
            .tryNext()
            .catch((err): Res => {
              log('restarting', err)
              return { ts: null }
            })
            .then(doc => (doc ? next(step3({ _id: streamName, ts: l.ts }), 'restart') : step8(l))),
        'wait for change',
      )
    }
    return skip
      ? withStop(() => SynchronousPromise.resolve(next(step3(null), 'clone into new collection')))
      : stop
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

export interface SnapshotStreamHKT extends HKT<O2> {
  readonly out: SnapshotStreamExecutionResult<I<O2, this>[0], I<O2, this>[1]>
}
export interface DeltaHKT extends HKT<O3> {
  readonly out: DeltaStages<I<O3, this>[0], I<O3, this>[1], I<O3, this>[2]>
}

export const staging = <V extends Model, KK extends StrKey<V>>(
  view: View<V, Allowed<KK>>,
  streamName: string,
  skip = false,
  after?: () => Promise<void>,
): DeltaPipe<AllowedPick<V, KK>, AllowedPick<V, KK>, SnapshotStreamHKT, DeltaHKT> =>
  pipe<AllowedPick<V, KK>, AllowedPick<V, KK>, AllowedPick<V, KK>, SnapshotStreamHKT, DeltaHKT>(
    input => executes(view, input, streamName, skip, after),
    emptyDelta(),
    concatDelta,
    emptyDelta,
  )

