import type { JsonObj } from '../../types'
import type { Expr, Query } from '../types'

export const $expr = <D extends JsonObj, C>(expr: Expr<boolean, D, C>): Query<D, C> => ({
  raw: f => ({ $expr: expr.raw(f) }),
  expr,
})
