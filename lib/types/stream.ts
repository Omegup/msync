import type { Timestamp } from 'mongodb'
import type { App, HKT, ID, J, O, RawObj, ReadonlyCollection, Rec, Type } from '../../types'
import type { Field } from '../field'
import type { Runner, HasJob } from './machine'

declare const RawStage: unique symbol

type RawArr = readonly RawObj[]
export interface RawStages<out Q, in S extends Q, out R extends Q, in C = unknown, out M = number>
  extends RawArr {
  [Type]?(_: typeof RawStage, source: S, ctx: C, q: Q): readonly [typeof RawStage, R, M, Q]
}

export type FRawStages<
  out Q,
  in S extends Q & J,
  out R extends Q & J,
  in C = unknown,
  out M extends number = number,
> = <F extends HKT<J, J>>(
  f: <T extends J>() => Field<App<F, T>, T>,
) => RawStages<App<F, Q & J>, App<F, S>, App<F, R>, C, M>

export type DeltaStages<out Q, in S extends Q & J, out R extends Q & J, in C = unknown> = {
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
export type Stages<out Q, out R extends Q, M extends number = number> = <E>(
  consume: <S, B extends Q>(value: TStages<S, Q, B, R, M>) => E,
) => E

export type StreamRunner<out V> = <Result>(
  // this is the final input that should end with a merge stage
  input: RawStages<unknown, V, Result>,
) => Runner<readonly Result[], HasJob>

export type SimpleStreamExecutionResult<out Q, out V extends Q> = {
  readonly out: StreamRunner<OutInput<V>>
  readonly stages: Stages<Q, V, 1>
}

export type SnapshotStreamExecutionResult<out Q, out V extends Q> = {
  readonly out: StreamRunner<Delta<V>>
  readonly stages: Stages<Before<Q>, Before<V>>
}

export type Stream<
  out Q extends J,
  in out T extends Q,
  in out F extends HKT<[J, J]>,
  in out G extends HKT<[J, J, J]>,
> = <Q2 extends J, Result extends Q2>(
  input: App<G, [Q2 | T, T, Result]>,
) => App<F, [Q | Q2, Result]>

export type TS = { readonly touchedAt: Timestamp }
export type Del = O<{ readonly deletedAt: Timestamp } & ID & TS>
export type D = O<{ readonly deletedAt: Timestamp | null | undefined } & ID>
export type Model = D & TS

export type OutInput<T> = Rec<'before', O<ID> | null> & Rec<'after', T | null>

export type SimpleStream<in out Q extends J, out T extends Q> = <Q2 extends J, Result extends Q2>(
  input: LinStages<Q2 | T, T, Result>,
) => SimpleStreamExecutionResult<Q | Q2, Result>
// T1 {a: 1, b: 2} T2 {a: 1, b: 2, c: 3}
// 1 accepts LinStages<{a: 1, b: 2}, {a: 1, b: 2}, never>
// 2 accepts LinStages<{a: 1, b: 2, c:3}, {a: 1, b: 2, c:3}, never>

export type BA = 'before' | 'after'
export type PreDelta<T, K extends BA = BA, E = unknown> = Rec<K, T> & E
export type Delta<T, K extends BA = BA, E = unknown> = PreDelta<T | null, K, E>
export type Before<T> = PreDelta<T, 'before'>
export type After<T> = Delta<T, 'after'>
export type UDelta<T, E = { readonly updated: boolean }> = Delta<T | null, 'after', ID> &
  Partial<Delta<T | null, 'before'>> &
  E

// this type of streams is based on the separation between
// • last snapshot which is the last data successfully synced
// • and the new incoming data to be synced
export type SnapshotStream<out Q extends J, in out T extends Q> = <Q2 extends J, Result extends Q2>(
  // this input doesn't end necessarily with merge stage, cuz it can be used for another lookup
  // so input can be used to construct the stages of the left/rigth join of another lookup
  input: DeltaStages<Q2 | T, T, Result>,
) => SnapshotStreamExecutionResult<Q | Q2, Result>
