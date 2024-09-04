import type { App, Arr, HKT, RORec, notArr } from '../../types'
import type { BoolExpr, Expr } from '../types'
import { asBoolExpr, asExpr, asExprRaw } from './expr-base'

export const $size = <T, D, C>(expr: Expr<Arr<T>, D, C>) =>
  asExpr<number, D, C>({
    raw: f => asExprRaw({ $size: expr.raw(f) }),
  })
export const $filter = <T, D, K extends string, C = unknown>({
  as,
  cond,
  expr,
  limit,
}: {
  expr: Expr<Arr<T>, D, C>
  as: K
  cond: Expr<boolean, D, C & RORec<K, T>>
  limit?: Expr<number, D, C>
}) =>
  asExpr<Arr<T>, D, C>({
    raw: f =>
      asExprRaw({ $filter: { input: expr.raw(f), as, cond: cond.raw(f), limit: limit?.raw(f) } }),
  })
export const $sortArray = <T, D, C, K extends keyof T>({
  sortBy,
  expr,
  order,
}: {
  expr: Expr<Arr<T>, D, C>
  sortBy: K
  order?: 1 | -1
}) => asExpr<Arr<T>, D, C>({
  raw: f => asExprRaw({ $sortArray: { input: expr.raw(f), sortBy: { [sortBy]: order ?? -1 } } }),
})

export const $isArray = <T extends notArr, D, C, F extends HKT<T | Arr<T>>>(
  expr: Expr<T | Arr<T>, D & (App<F, T> | App<F, Arr<T>>), C>,
)=>  asBoolExpr<D & App<F, Arr<T>>, D & App<F, T>, C> ({
  raw: f => asExprRaw({ $isArray: expr.raw(f) }),
})

export const $array = <T, D, C>(...exprs: Expr<T, D, C>[]): Expr<Arr<T>, D, C> => ({
  raw: (f): {} => exprs.map(x => x.raw(f)),
})

export const $concat = <T, D, C>(...exprs: Expr<Arr<T>, D, C>[]): Expr<Arr<T>, D, C> => ({
  raw: f => ({ $concatArrays: exprs.map(x => x.raw(f)) }),
})

export const $first = <T, D, C>(expr: Expr<Arr<T>, D, C>): Expr<T | null, D, C> => ({
  raw: f => ({ $first: expr.raw(f) }),
})
export const $mergeObjects = <T1, T2, D, C = unknown>(
  ...exprs: readonly [Expr<T1, D, C>, Expr<T2, D, C>]
): Expr<T1 & T2, D, C> => ({
  raw: f => ({ $mergeObjects: exprs.map(x => x.raw(f)) }),
})
