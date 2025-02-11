import type { BSON, Filter, Timestamp, UpdateFilter } from 'mongodb'
import type {
  App,
  HKT,
  ID,
  O,
  RawObj,
  ReadonlyCollection,
  Rec,
  Type,
  WriteonlyCollection,
} from '../../types'
import type { Field } from '../field'
import type { HasJob, Runner } from './machine'

declare const RawStage: unique symbol

type RawArr = readonly RawObj[]
export interface RawStages<out Q, in S extends Q, out R extends Q, in C = unknown, out M = number>
  extends RawArr {
  [Type]?(_: typeof RawStage, source: S, ctx: C, q: Q): readonly [typeof RawStage, R, M, Q]
}

export type FRawStages<
  out Q,
  in S extends Q & O,
  out R extends Q & O,
  in C = unknown,
  out M extends number = number,
> = <F extends HKT<O, O>>(
  f: <T extends O>() => Field<App<F, T>, T>,
) => RawStages<App<F, Q & O>, App<F, S>, App<F, R>, C, M>

export type DeltaStages<out Q, in S extends Q & O, out R extends Q & O, in C = unknown> = {
  delta: RawStages<unknown, Delta<S>, Delta<R>, C>
  raw: FRawStages<Q, S, R, C>
}
export type LinStages<out Q, in S extends Q, out R extends Q, in C = unknown> = {
  lin: RawStages<Q, S, R, C, 1>
}
export type TStages<
  in out S,
  out Q,
  in out B extends Q,
  out R extends Q,
  M extends number = number,
> = {
  coll: ReadonlyCollection<S>
  input: RawStages<unknown, S, B, unknown, M>
  exec: RawStages<Q, B, R, unknown, M>
}
export type Stages<out Q, out R extends Q, out SDom> = <E>(
  consume: <S extends SDom, B extends Q>(value: TStages<S, Q, B, R>) => E,
) => E

export type Actions<W> = {
  updateMany: [Filter<W>, UpdateFilter<W> | BSON.Document[]]
}

export type TeardownRecord<W, M extends keyof Actions<W>> = {
  collection: WriteonlyCollection<W>
  method: M
  params: Actions<W>[M]
}

export type StreamRunnerParam<in V, out Result> = {
  raw: (first: boolean) => RawStages<unknown, V, Result>
  teardown: <R>(consume: <W, M extends keyof Actions<W>>(x: TeardownRecord<W, M>) => R) => R
}

export type StreamRunner<out V> = <Result>(
  // this is the final input that should end with a merge stage
  input: StreamRunnerParam<V, Result>,
) => Runner<readonly Result[], HasJob>

export type SimpleStreamExecutionResult<out Q, out V extends Q> = {
  readonly out: StreamRunner<V>
}

export type SnapshotStreamExecutionResult<out Q, out V extends Q> = {
  readonly out: StreamRunner<Delta<V>>
  readonly stages: Stages<Before<Q>, Before<V>, UBefore<Q>>
}

export type Stream<
  out Q extends O,
  in out T extends Q,
  in out F extends HKT<[O, O]>,
  in out G extends HKT<[O, O, O]>,
> = <Q2 extends O, Result extends Q2>(
  input: App<G, [Q2 | T, T, Result]>,
) => App<F, [Q | Q2, Result]>

export type TS = { readonly touchedAt: Timestamp }
export type Del = O<{ readonly deletedAt: Timestamp } & ID & TS>
export type D = O<{ readonly deletedAt?: Timestamp | null | undefined } & ID>
export type Model = D & TS

export type OutInput<T, A = T | null> = ID & Rec<'after', A>

export type SimpleStream<in out Q extends O, out T extends Q> = <Q2 extends O, Result extends Q2>(
  input: LinStages<Q2 | T, T, Result>,
) => SimpleStreamExecutionResult<Q | Q2, Result>
// T1 {a: 1, b: 2} T2 {a: 1, b: 2, c: 3}
// 1 accepts LinStages<{a: 1, b: 2}, {a: 1, b: 2}, never>
// 2 accepts LinStages<{a: 1, b: 2, c:3}, {a: 1, b: 2, c:3}, never>

export type BA = 'before' | 'after'
export type PreDelta<T, K extends BA = BA, E = unknown> = Rec<K, T> & E
export type Delta<T, K extends BA = BA, E = ID> = PreDelta<T | null, K, E>
export type Before<T> = PreDelta<T, 'before'>
export type After<T> = Delta<T, 'after'>
export type UBefore<T> = O & Partial<Delta<T | null, 'before'>>
export type UDelta<T, E = { readonly updated: boolean }> = Delta<T, 'after', ID> & UBefore<T> & E

// this type of streams is based on the separation between
// • last snapshot which is the last data successfully synced
// • and the new incoming data to be synced
export type SnapshotStream<out Q extends O, in out T extends Q> = <Q2 extends O, Result extends Q2>(
  // this input doesn't end necessarily with merge stage, cuz it can be used for another lookup
  // so input can be used to construct the stages of the left/rigth join of another lookup
  input: DeltaStages<Q2 | T, T, Result>,
) => SnapshotStreamExecutionResult<Q | Q2, Result>
