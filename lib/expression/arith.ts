import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'

export const max = <D, C>(...expr: Expr<number, D, C>[]) =>
  asExpr<number, D, C>({
    raw: f => asExprRaw({ $max: expr.map(e => e.raw(f).get()) }),
  })

export const lt = <D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]) =>
  asExpr<boolean, D, C>({
    raw: f => asExprRaw({ $lt: expr.map(e => e.raw(f).get()) }),
  })
export const gt = <D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]) =>
  asExpr<boolean, D, C>({
    raw: f => asExprRaw({ $gt: expr.map(e => e.raw(f).get()) }),
  })

export const lte: {
  <D, C>(...expr: [Expr<Date, D, C>, Expr<Date, D, C>]): Expr<boolean, D, C>
  <D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<boolean, D, C>
} = <D, C>(...expr: [Expr<number | Date, D, C>, Expr<number | Date, D, C>]) =>
  asExpr<boolean, D, C>({
    raw: f => asExprRaw({ $lte: expr.map(e => e.raw(f).get()) }),
  })
export const gte: {
  <D, C>(...expr: [Expr<Date, D, C>, Expr<Date, D, C>]): Expr<boolean, D, C>
  <D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<boolean, D, C>
} = <D, C>(...expr: [Expr<number | Date, D, C>, Expr<number | Date, D, C>]) =>
  asExpr<boolean, D, C>({
    raw: f => asExprRaw({ $gte: expr.map(e => e.raw(f).get()) }),
  })

type Num = number | null | undefined

export function subtract<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return asExpr<Num, D, C>({
    raw: f => asExprRaw({ $subtract: expr.map(e => e.raw(f).get()) }),
  })
}

export function add<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return asExpr<Num, D, C>({
    raw: f => asExprRaw({ $add: expr.map(e => e.raw(f).get()) }),
  })
}

export function divide<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return asExpr<Num, D, C>({
    raw: f => asExprRaw({ $divide: expr.map(e => e.raw(f).get()) }),
  })
}

export function multiply<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return asExpr<Num, D, C>({
    raw: f => asExprRaw({ $multiply: expr.map(e => e.raw(f).get()) }),
  })
}

export function floor<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return asExpr<Num, D, C>({
    raw: f => asExprRaw({ $floor: expr.raw(f).get() }),
  })
}

export function ceil<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return asExpr<Num, D, C>({
    raw: f => asExprRaw({ $ceil: expr.raw(f).get() }),
  })
}
