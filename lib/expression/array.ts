import type { App, Arr, HKT, RORec, notArr } from '../../types'
import type { Expr } from '../types'
import { asBoolExpr, asExpr, asExprRaw } from './expr-base'

export const $size = <T, D, C>(expr: Expr<Arr<T>, D, C>) =>
  asExpr<number, D, C>({
    raw: f => asExprRaw({ $size: expr.raw(f).get() }),
  })
export const $filter = <T, D, K extends string, C = unknown>({
  as,
  cond,
  expr,
  limit,
}: {
  expr: Expr<Arr<T>, D, C>
  as: K
  cond: Expr<unknown, D, C & RORec<K, T>>
  limit?: Expr<number, D, C>
}) =>
  asExpr<Arr<T>, D, C>({
    raw: f =>
      asExprRaw({
        $filter: {
          input: expr.raw(f).get(),
          as,
          cond: cond.raw(f).get(),
          limit: limit?.raw(f).get(),
        },
      }),
  })
export const $sortArray = <T, D, C, K extends keyof T>({
  sortBy,
  expr,
  order,
}: {
  expr: Expr<Arr<T>, D, C>
  sortBy: K
  order?: 1 | -1
}) =>
  asExpr<Arr<T>, D, C>({
    raw: f =>
      asExprRaw({ $sortArray: { input: expr.raw(f).get(), sortBy: { [sortBy]: order ?? -1 } } }),
  })

export const $isArray = <T extends notArr, D, C, F extends HKT<T | Arr<T>>>(
  expr: Expr<T | Arr<T>, D & (App<F, T> | App<F, Arr<T>>), C>,
) =>
  asBoolExpr<D & App<F, Arr<T>>, D & App<F, T>, C>({
    raw: f => asExprRaw<never, unknown, C>({ $isArray: expr.raw(f).get() }),
  })

export const $array = <T, D, C>(...exprs: Expr<T, D, C>[]) =>
  asExpr<Arr<T>, D, C>({
    raw: (f) => asExprRaw(exprs.map(x => x.raw(f).get())),
  })

export const $concat = <T, D, C>(...exprs: Expr<Arr<T>, D, C>[])=> asExpr<Arr<T>, D, C>({
  raw: f => asExprRaw({ $concatArrays: exprs.map(x => x.raw(f).get()) }),
})

export const $first = <T, D, C>(expr: Expr<Arr<T>, D, C>) => asExpr<T | null, D, C> ({
  raw: f => asExprRaw({ $first: expr.raw(f).get() }),
})
export const $last = <T, D, C>(expr: Expr<Arr<T>, D, C>) => asExpr<T | null, D, C> ({
  raw: f => asExprRaw({ $last: expr.raw(f).get() }),
})
export const $mergeObjects = <T1, T2, D, C = unknown>(
  ...exprs: readonly [Expr<T1, D, C>, Expr<T2, D, C>]
) => asExpr<T1 & T2, D, C>({
  raw: f => asExprRaw({ $mergeObjects: exprs.map(x => x.raw(f).get()) }),
})
