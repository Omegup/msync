import { Expr } from '../types'
export const concat = <D, C>(...expr: Expr<string, D, C>[]): Expr<string, D, C> => ({
  raw: () => ({ $concat: expr.map(e => e.raw()) }),
  eval: (d, c) => expr.map(e => e.eval(d, c)).join(''),
})

export const str = <D, C>(expr: Expr<unknown, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $toString: expr.raw() }),
  eval: (d, c) => expr.eval(d, c) + '',
})

export const field = <D, C, T extends object>(expr: {
  [K in keyof T]: Expr<T[K], D, C>
}): Expr<T, D, C> => ({
  raw: () => Object.fromEntries(Object.entries(expr).map(([k, e]) => [k, e.raw()])),
  eval: (d, c) =>
    Object.fromEntries(
      Object.entries(expr).flatMap(([k, e]) => {
        const r = e.eval(d, c)
        return r === undefined ? [] : [[k, r]]
      }),
    ),
})
