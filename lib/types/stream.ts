import type { Timestamp } from 'mongodb'
import type { App, HKT, ID, J, O, RawObj, ReadonlyCollection, Rec, Type } from '../../types'
import type { Field } from '../field'
import type { Runner, Working } from './machine'

declare const RawStage: unique symbol

type RawArr = readonly RawObj[]
export interface RawStages<in S, out R, in C = unknown, out M = number> extends RawArr {
  [Type]?(_: typeof RawStage, source: S, ctx: C): readonly [typeof RawStage, R, M]
}

export type FRawStages<
  in S extends J,
  out R extends J,
  in C = unknown,
  out M extends number = number,
> = <F extends HKT<J, J>>(
  f: <T extends J>() => Field<App<F, T>, T>,
) => RawStages<App<F, S>, App<F, R>, C, M>

export type DeltaStages<in S extends J, out R extends J, in C = unknown> = {
  delta: RawStages<Delta<S>, Delta<R>, C>
  raw: FRawStages<S, R, C>
}
export type LinStages<in S extends J, out R extends J, in C = unknown> = {
  lin: RawStages<S, R, C, 1>
}
export type TStages<in out S, out R, M extends number = number> = {
  stages: RawStages<S, R, unknown, M>
  coll: ReadonlyCollection<S>
}
export type Stages<out R, M extends number = number> = <E>(
  consume: <S>(value: TStages<S, R, M>) => E,
) => E

export type StreamRunner<V> = <Result>(
  // this is the final input that should end with a merge stage
  input: RawStages<V, Result>,
) => Runner<readonly Result[], Working>

export type SimpleStreamExecutionResult<V> = {
  readonly out: StreamRunner<OutInput<V>>
  readonly stages: Stages<V, 1>
}

export type SnapshotStreamExecutionResult<V> = {
  readonly out: StreamRunner<Delta<V>>
  readonly stages: Stages<Before<V>>
}

export type Stream<F extends HKT<J>, T extends J, G extends HKT<[J, J]>> = <Result extends J>(
  input: App<G, [T, Result]>,
) => App<F, Result>

export type TS = { readonly touchedAt: Timestamp }
export type D = O<{ readonly deletedAt: Timestamp | undefined } & ID>
export type Model = D & TS

export type OutInput<T> = Rec<'before', O<ID> | null> & Rec<'after', T | null>

export type SimpleStream<T extends J> = <Result extends J>(
  input: LinStages<T, Result>,
) => SimpleStreamExecutionResult<Result>

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
export type SnapshotStream<T extends J> = <Result extends J>(
  // this input doesn't end necessarily with merge stage, cuz it can be used for another lookup
  // so input can be used to construct the stages of the left/rigth join of another lookup
  input: DeltaStages<T, Result>,
) => SnapshotStreamExecutionResult<Result>

export type SnapshotStreamF<T extends J, F extends HKT<J>, G extends HKT<readonly [J, J]>> = <
  Result extends J,
>(
  input: App<G, [T, Result]>,
) => App<F, Result>
