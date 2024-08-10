import type { JsonObj, ReadonlyCollection, Type } from '../../types'
import type { Runner } from './machine'

declare const Pipeline: unique symbol
declare const RawStages: unique symbol

export type RawStages<out T> = {
  [Type]?: (_: typeof RawStages) => readonly [typeof RawStages, T]
  stages: JsonObj[]
  collection: ReadonlyCollection<T>
}
export type Stages<out T, in Param> = (param: Param) => RawStages<T>
export type StagesMapper<in S, out T, out S_Param, in T_Param = S_Param> = (
  previousStages: Stages<S, S_Param>,
) => Stages<T, T_Param>
export type Pipeline<in S, out T, out S_Param, in T_Param = S_Param> = {
  [Type]?(_: typeof Pipeline, s: S): readonly [typeof Pipeline, T]
  stages: (
    makeStages: <T, T_Param>(mapper: StagesMapper<S, T, S_Param, T_Param>) => Stages<T, T_Param>,
  ) => StagesMapper<S, T, S_Param, T_Param>
}

export type Stream<out T extends JsonObj, in Param> = {
  execute: <Result extends JsonObj>(
    input: Pipeline<T, Result, Param, never>,
  ) => Runner<readonly Result[]>
}
