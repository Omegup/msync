import { $matchDelta } from './$match-delta'
import type { doc } from '../../../types'
import { $expr } from '../../predicate/$expr'
import type { DeltaStages, Expr } from '../../types'
import { $match1 } from '../raws'

export const $match = <T extends doc>(query: Expr<boolean, T>): DeltaStages<T, T, T> => ({
  raw: $match1($expr(query)),
  delta: $matchDelta<T>(query),
})
