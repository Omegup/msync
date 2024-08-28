import type { Expr } from '../types'

export const max = <D, C>(...expr: Expr<number, D, C>[]): Expr<number, D, C> => ({
  raw: () => ({ $max: expr.map(e => e.raw()) }),
})

export const lt = <D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<boolean, D, C> => ({
  raw: () => ({ $lt: expr.map(e => e.raw()) }),
})

export const $lte: {
  <D, C>(...expr: [Expr<Date, D, C>, Expr<Date, D, C>]): Expr<boolean, D, C>
  <D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<boolean, D, C>
} = <D, C>(
  ...expr: [Expr<number | Date, D, C>, Expr<number | Date, D, C>]
): Expr<boolean, D, C> => ({
  raw: () => ({ $lte: expr.map(e => e.raw()) }),
})

type Num = number | null | undefined

export function subtract<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $subtract: expr.map(e => e.raw()) }),
  }
}

export function add<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $add: expr.map(e => e.raw()) }),
  }
}

export function divide<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $divide: expr.map(e => e.raw()) }),
  }
}

export function multiply<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $multiply: expr.map(e => e.raw()) }),
  }
}

export function floor<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return {
    raw: () => ({ $floor: expr.raw() }),
  }
}

export function ceil<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return {
    raw: () => ({ $ceil: expr.raw() }),
  }
}
