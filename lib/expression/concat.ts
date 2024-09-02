import type { O } from '../../types'
import type { Expr } from '../types'
export const concat = <D, C>(...expr: Expr<string, D, C>[]): Expr<string, D, C> => ({
  raw: f => ({ $concat: expr.map(e => e.raw(f)) }),
})

export const str = <D, C>(expr: Expr<unknown, D, C>): Expr<string, D, C> => ({
  raw: f => ({ $toString: expr.raw(f) }),
})

export type DDDD<D, T, C = unknown> = {
  [K in string & keyof T]: Expr<T[K], D, C>
}

export const field = <T extends object, D, C = unknown>(expr: DDDD<D, T, C>): Expr<O<T>, D, C> => ({
  raw: f => Object.fromEntries(Object.entries(expr).map(([k, e]) => [k, e.raw(f)])),
})
