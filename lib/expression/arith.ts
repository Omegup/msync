import type { Expr } from '../types'

export const max = <D, C>(...expr: Expr<number, D, C>[]): Expr<number, D, C> => ({
  raw: () => ({ $max: expr.map(e => e.raw()) }),
  eval: (d, c) => Math.max(...expr.map(e => e.eval(d, c))),
})

export const lt = <D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<boolean, D, C> => ({
  raw: () => ({ $lt: expr.map(e => e.raw()) }),
  eval: (d, c) => {
    const [a, b] = expr.map(e => e.eval(d, c))
    return a < b
  },
})

export const $lte: {
  <D, C>(...expr: [Expr<Date, D, C>, Expr<Date, D, C>]): Expr<boolean, D, C>
  <D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<boolean, D, C>
} = <D, C>(
  ...expr: [Expr<number | Date, D, C>, Expr<number | Date, D, C>]
): Expr<boolean, D, C> => ({
  raw: () => ({ $lte: expr.map(e => e.raw()) }),
  eval: (d, c) => {
    const [a, b] = expr.map(e => e.eval(d, c))
    return a <= b
  },
})

type Num = number | null | undefined

const keepNulls =
  <T extends readonly number[]>(f: (...x: T) => number) =>
  (...x: { readonly [K in keyof T]: T[K] | undefined | null }) =>
    x.some(x => x == null) ? null : f(...(x as T))

export function subtract<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function subtract<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $subtract: expr.map(e => e.raw()) }),
    eval: (d, c) => expr.map(e => e.eval(d, c)).reduce(keepNulls((a, b) => a - b)),
  }
}

export function add<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function add<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $add: expr.map(e => e.raw()) }),
    eval: (d, c) => expr.map(e => e.eval(d, c)).reduce(keepNulls((a, b) => a + b)),
  }
}

export function divide<D, C>(...expr: [Expr<number, D, C>, Expr<number, D, C>]): Expr<number, D, C>
export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>

export function divide<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $divide: expr.map(e => e.raw()) }),
    eval: (d, c) => expr.map(e => e.eval(d, c)).reduce(keepNulls((a, b) => a / b)),
  }
}

export function multiply<D, C>(
  ...expr: [Expr<number, D, C>, Expr<number, D, C>]
): Expr<number, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C>
export function multiply<D, C>(...expr: [Expr<Num, D, C>, Expr<Num, D, C>]): Expr<Num, D, C> {
  return {
    raw: () => ({ $multiply: expr.map(e => e.raw()) }),
    eval: (d, c) => expr.map(e => e.eval(d, c)).reduce(keepNulls((a, b) => a * b)),
  }
}

export function floor<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function floor<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return {
    raw: () => ({ $floor: expr.raw() }),
    eval: (d, c) => keepNulls(Math.floor)(expr.eval(d, c)),
  }
}

export function ceil<D, C>(expr: Expr<number, D, C>): Expr<number, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C>
export function ceil<D, C>(expr: Expr<Num, D, C>): Expr<Num, D, C> {
  return {
    raw: () => ({ $ceil: expr.raw() }),
    eval: (d, c) => keepNulls(Math.ceil)(expr.eval(d, c)),
  }
}
