import { $matchDelta } from '.'
import type { O } from '../../../types'
import type { DeltaStages, Query } from '../../types'
import { $match1 } from '../raws'

export const $match = <T extends O>(query: Query<T>): DeltaStages<T, T, T> => ({
  raw: $match1(query),
  delta: $matchDelta(query),
})
