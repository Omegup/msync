import type { App, HKT, ID, J, O, RawObj, ReadonlyCollection, Rec, Type } from '../../types'
import type { Field } from '../field'
import type { Runner, Working } from './machine'

declare const RawStage: unique symbol

type RawArr = readonly RawObj[]
export interface RawStages<in S, out R, in C = unknown> extends RawArr {
  [Type]?(_: typeof RawStage, source: S, ctx: C): readonly [typeof RawStage, R]
}
export type DeltaStages<S extends J, R extends J> = {
  delta: RawStages<Delta<S>, Delta<R>>
  raw: <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ) => RawStages<App<F, S>, App<F, R>>
}
export type TStages<in out S, out R> = {
  stages: RawStages<S, R>
  coll: ReadonlyCollection<S>
}
export type Stages<out R> = <E>(consume: <S>(value: TStages<S, R>) => E) => E

export type SnapshotStreamExecutionResult<V> = {
  readonly run: <Result extends J>(
    // this is the final input that should end with a merge stage
    input: RawStages<Delta<V>, Result>,
  ) => Runner<readonly Result[], Working>
  readonly stages: Stages<Before<V>>
}

export type Stream<F extends HKT<J>, T extends J> = <Result extends J>(
  input: DeltaStages<T, Result>,
) => App<F, Result>

export type BA = 'before' | 'after'
export type PreDelta<T, K extends BA = BA, E = unknown> = Rec<K, T> & E
export type Delta<T, K extends BA = BA, E = unknown> = PreDelta<T | null, K, E>
export type Before<T> = PreDelta<T, 'before'>
export type After<T> = Delta<T, 'after'>
export type UDelta<T> = O & ID & Partial<Delta<T | null, BA, ID>> & { readonly updated: boolean }

// this type of streams is based on the separation between
// • last snapshot which is the last data successfully synced
// • and the new incoming data to be synced
export type SnapshotStream<T extends J> = <Result extends J>(
  // this input doesn't end necessarily with merge stage, cuz it can be used for another lookup
  // so input can be used to construct the stages of the left/rigth join of another lookup
  input: DeltaStages<T, Result>,
) => SnapshotStreamExecutionResult<Result>
