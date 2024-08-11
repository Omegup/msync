import type { JsonObj } from '../../types'
import type { ExecutionResult, Pipeline, Stream } from '../types'

export const $lookup = <T extends JsonObj, U extends JsonObj, Param extends { source: 'snapshot' }>(
  left: Stream<T, Param>,
  right: Stream<U, Param>,
): Stream<{ left: T; right: U }, Param> => {
  return <Result, R_Param>(input: Pipeline<{ left: T; right: U }, Result, Param, R_Param>): ExecutionResult<Result, R_Param> => {
    left()
    input.stages()
    return 0
  }
}
