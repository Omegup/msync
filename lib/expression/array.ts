import type { App, HKT } from '../../types'
import type { BoolExpr, Expr } from '../types'

export const $size = <T, D, C>(expr: Expr<T[], D, C>): Expr<number, D, C> => ({
  raw: f => ({ $size: expr.raw(f) }),
})
export const $filter = <T, D, C, K extends string>({
  as,
  cond,
  expr,
  limit,
}: {
  expr: Expr<T[], D, C>
  as: K
  cond: Expr<boolean, D, C & Record<K, T>>
  limit?: Expr<number, D, C>
}): Expr<T[], D, C> => ({
  raw: f => ({ $filter: { input: expr.raw(f), as, cond: cond.raw(f), limit: limit?.raw(f) } }),
})
export const $sortArray = <T, D, C, K extends keyof T>({
  sortBy,
  expr,
  order,
}: {
  expr: Expr<T[], D, C>
  sortBy: K
  order?: 1 | -1
}): Expr<T[], D, C> => ({
  raw: f => ({ $sortArray: { input: expr.raw(f), sortBy: { [sortBy]: order ?? -1 } } }),
})

export const $isArray = <T, D, C, F extends HKT<T | readonly T[]>>(
  expr: Expr<T | readonly T[], D & (App<F, T> | App<F, readonly T[]>), C>,
): BoolExpr<D & App<F, readonly T[]>, D & App<F, T>, C> => ({
  raw: f => ({ $isArray: expr.raw(f) }),
})

export const $array = <T, D, C>(...exprs: Expr<T, D, C>[]): Expr<T[], D, C> => ({
  raw: (f): {} => exprs.map(x => x.raw(f)),
})

export const $concat = <T, D, C>(...exprs: Expr<T[], D, C>[]): Expr<T[], D, C> => ({
  raw: f => ({ $concatArrays: exprs.map(x => x.raw(f)) }),
})

export const $first = <T, D, C>(expr: Expr<T[], D, C>): Expr<T | null, D, C> => ({
  raw: f => ({ $first: expr.raw(f) }),
})
export const $mergeObjects = <T extends object, D, C>(
  ...exprs: Expr<T, D, C>[]
): Expr<T, D, C> => ({
  raw: f => ({ $mergeObjects: exprs.map(x => x.raw(f)) }),
})
