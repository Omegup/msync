import type { Expr } from '../types'

export const max = <D, C>(...expr: Expr<number, D, C>[]): Expr<number, D, C> => ({
  raw: f => ({ $max: expr.map(e => e.raw(f)) }),
})

export const lt = <D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<boolean, D, C> => ({
  raw: f => ({ $lt: expr.map(e => e.raw(f)) }),
})

export const $lte: {
  <D, C>(...expr: [Expr<Date, D, C>, Expr<Date, D, C>]): Expr<boolean, D, C>
  <D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<boolean, D, C>
} = <D, C>(
  ...expr: [Expr<number | Date, D, C>, Expr<number | Date, D, C>]
): Expr<boolean, D, C> => ({
  raw: f => ({ $lte: expr.map(e => e.raw(f)) }),
})

type Num = number | null | undefined

export function subtract<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: f => ({ $subtract: expr.map(e => e.raw(f)) }),
  }
}

export function add<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: f => ({ $add: expr.map(e => e.raw(f)) }),
  }
}

export function divide<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: f => ({ $divide: expr.map(e => e.raw(f)) }),
  }
}

export function multiply<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: f => ({ $multiply: expr.map(e => e.raw(f)) }),
  }
}

export function floor<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return {
    raw: f => ({ $floor: expr.raw(f) }),
  }
}

export function ceil<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return {
    raw: f => ({ $ceil: expr.raw(f) }),
  }
}
