import type { JsonObj, ReadonlyCollection, Type } from '../../types'
import type { Runner } from './machine'

declare const RawStage: unique symbol
declare const Pipeline: unique symbol

export type RawStagesPart<S, R> = readonly JsonObj[] & {
  [Type]?(_: typeof RawStage, source: S): readonly [typeof RawStage, R]
}

export type RawStages<out R> = <E>(
  consume: <S>(value: { stages: RawStagesPart<S, R>; coll: ReadonlyCollection<S> }) => E,
) => E

export type Stages<out T, in out Param> = {
  readonly get: (param: Partial<Param>) => RawStages<T>
  readonly default: Param
}
export type StagesMapper<in S, out T, in out S_Param, in out T_Param = S_Param> = (
  previousStages: Stages<S, S_Param>,
) => Stages<T, T_Param>
export type Pipeline<in S, out T, in out S_Param, in out T_Param = S_Param> = {
  [Type]?: (_: typeof Pipeline, s: S) => readonly [typeof Pipeline, T]
  readonly stages: StagesMapper<S, T, S_Param, T_Param>
}
export type ExecutionResult<Result, R_Param> = {
  readonly run: () => Runner<readonly Result[]>
  readonly stages: Stages<Result, R_Param>
}

export type Stream<out T extends JsonObj, in out T_Param> = <Result extends JsonObj, R_Param>(
  input: Pipeline<T, Result, T_Param, R_Param>,
) => ExecutionResult<Result, R_Param>
