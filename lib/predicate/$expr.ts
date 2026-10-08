import type { O, RawObj } from '../../types'
import type { Expr, Query } from '../types'
import { safeNarrow } from '../utils/json'

export const $expr = <D extends O, C>(expr: Expr<boolean, D, C>): Query<D, C> => ({
  raw: f => safeNarrow<RawObj>()({ $expr: expr.raw(f).get() }),
})
