import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'

export const dayAndMonthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $dateToString: { date: date.raw(f).get(), format: '%m-%d' } }),
  })
export const now = <D, C>(): Expr<Date, D, C> =>
  asExpr<Date, D, C>({
    raw: f => asExprRaw('$$NOW'),
  })
