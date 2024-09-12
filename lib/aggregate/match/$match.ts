import { $matchDelta } from '.'
import type { J } from '../../../types'
import type { DeltaStages, Query } from '../../types'
import { $match1 } from '../raws'

export const $match = <T extends J>(query: Query<T>): DeltaStages<T, T> => ({
  raw: $match1(query),
  delta: $matchDelta(query),
})
