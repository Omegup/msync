import type { App, HKT, JsonObj, ReadonlyCollection, Type } from '../../types'
import type { Runner } from './machine'

declare const RawStage: unique symbol
declare const Pipeline: unique symbol

export type RawStagesPart<S, R> = readonly JsonObj[] & {
  [Type]?(_: typeof RawStage, source: S): readonly [typeof RawStage, R]
}
export type RawStagesSource<S, R> = { stages: RawStagesPart<S, R>; coll: ReadonlyCollection<S> }
export type RawStages<out R> = <E>(
  consume: <S>(value: RawStagesSource<S, R>) => E,
) => E

declare const NeverUsed: unique symbol

type CovHack<out T> = {
  readonly [_ in typeof NeverUsed]?: T
}

export type Stages<out T, in out Param> = (param: Partial<Param>) => RawStages<T> & CovHack<Param>

export type StagesMapper<in S, out T, in out S_Param, in out T_Param = S_Param> = (
  previousStages: Stages<S, S_Param>,
) => Stages<T, T_Param>
export type Pipeline<in S, out T, in out S_Param, in out T_Param = S_Param> = {
  [Type]?: (_: typeof Pipeline, s: S) => readonly [typeof Pipeline, T]
  readonly stages: StagesMapper<S, T, S_Param, T_Param>
}
export type ExecutionResult<V> = {
  readonly run: <Result extends JsonObj>(
    input: RawStagesPart<V, Result>,
  ) => Runner<readonly Result[], unknown>
  readonly stages: RawStages<V>
}

export type Stream<T extends JsonObj, F extends HKT<JsonObj>> = <Result extends JsonObj>(
  input: RawStagesPart<T, Result>,
) => App<F, Result>

export type StreamSnapshot<T extends JsonObj> = <Result extends JsonObj>(
  input: RawStagesPart<T, Result>,
) => ExecutionResult<Result>

export interface StreamHKT extends HKT<JsonObj> {}
