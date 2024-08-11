import type { JsonObj } from '../../types'
import { $matchRaw } from '../aggregate/$match-raw'
import { concatRaw } from '../aggregate/concat-raw'
import type { Pipeline, Query, Stream } from '../types'

const run = <T extends JsonObj, Param, Result extends JsonObj, R_Param>(
  q: Query<T>,
  source: Stream<T, Param>,
  input: Pipeline<T, Result, Param, R_Param>,
) => source(concatRaw($matchRaw(q), input))

export const $match =
  <T extends JsonObj>(q: Query<T>) =>
  <Param>(source: Stream<T, Param>): Stream<T, Param> =>
  input =>
    run(q, source, input)
