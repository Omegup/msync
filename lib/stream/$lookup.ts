import type { JsonObj } from '../../types'
import type { ExecutionResult, Pipeline, Stream } from '../types'

export const $lookup = <
  T extends JsonObj,
  U extends JsonObj,
  Param extends { source: 'snapshot' | 'new' },
>(
  left: Stream<T, Omit<Param, 'source'> & { source: 'snapshot' | 'new' }>,
  right: Stream<U, Param>,
): Stream<{ left: T; right: U }, Param> => {
  return <Result, R_Param>(
    input: Pipeline<{ left: T; right: U }, Result, Param, R_Param>,
  ): ExecutionResult<Result, R_Param> => {
    left<T, Omit<Param, 'source'> & { source: 'snapshot' | 'new' }>({stages: source => param => source({...param, source: 'new'})})
    input.stages()
    return {
      stages: (x)=>x.source,
      run: () => {
        return 0
      },
    }
  }
}
