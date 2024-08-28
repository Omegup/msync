import type { Expr } from '../types'
export const concat = <D, C>(...expr: Expr<string, D, C>[]): Expr<string, D, C> => ({
  raw: () => ({ $concat: expr.map(e => e.raw()) }),
})

export const str = <D, C>(expr: Expr<unknown, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $toString: expr.raw() }),
})

export const field = <D, C, T extends object>(expr: {
  [K in keyof T]: Expr<T[K], D, C>
}): Expr<T, D, C> => ({
  raw: () => Object.fromEntries(Object.entries(expr).map(([k, e]) => [k, e.raw()])),
})
