import type { JsonObj } from '../../types'
import type { Pipeline } from '../types'
import { id } from '../utils/json'

export const concatRaw = <T extends JsonObj, V extends JsonObj, W, T_Param, V_Param, W_Param>(
  a: Pipeline<T, V, T_Param, V_Param>,
  b: Pipeline<V, W, V_Param, W_Param>,
): Pipeline<T, W, T_Param, W_Param> => ({
  stages: previous => b.stages(a.stages(previous)),
})

export const emptyRaw = <T extends JsonObj, Param>(): Pipeline<T, T, Param> => ({ stages: id })
