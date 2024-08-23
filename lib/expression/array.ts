import type { App, HKT } from "../../types"
import type { BoolExpr, Expr } from "../types"

export const $size = <T, D, C>(expr: Expr<T[], D, C>): Expr<number, D, C> => ({
  raw: () => ({ $size: expr.raw() }),
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
  raw: () => ({ $filter: { input: expr.raw(), as, cond: cond.raw(), limit: limit?.raw() } }),
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
  raw: () => ({ $sortArray: { input: expr.raw(), sortBy: { [sortBy]: order ?? -1 } } }),
})

export const $isArray = <T, D, C, F extends HKT<T | readonly T[]>>(
  expr: Expr<T | readonly T[], D & (App<F, T> | App<F, readonly T[]>), C>,
): BoolExpr<D & App<F, readonly T[]>, D & App<F, T>, C> => ({
  raw: () => ({ $isArray: expr.raw() }),
})

export const $array = <T, D, C>(...exprs: Expr<T, D, C>[]): Expr<T[], D, C> => ({
  raw: (): {} => exprs.map(x => x.raw()),
})

export const $concat = <T, D, C>(...exprs: Expr<T[], D, C>[]): Expr<T[], D, C> => ({
  raw: () => ({ $concatArrays: exprs.map(x => x.raw()) }),
})

export const $first = <T, D, C>(expr: Expr<T[], D, C>): Expr<T | null, D, C> => ({
  raw: () => ({ $first: expr.raw() }),
})
export const $mergeObjects = <T extends object, D, C>(
  ...exprs: Expr<T, D, C>[]
): Expr<T, D, C> => ({
  raw: () => ({ $mergeObjects: exprs.map(x => x.raw()) }),
})
