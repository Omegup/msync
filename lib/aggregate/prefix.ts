import type { JsonObj } from '../../types'
import type { RawStages } from '../types'

export const concatStages = <T, V>(
  { coll, stages }: RawStages<T>,
  newStages: JsonObj[],
): RawStages<V> => ({
  stages: [...stages, ...newStages],
  coll,
})

export const appendStages =
  (stages: JsonObj[]) =>
  <T, Param>(previousStages: (param: Param) => RawStages<T>) =>
  <V>(param: Param): RawStages<V> =>
    concatStages(previousStages(param), stages)
