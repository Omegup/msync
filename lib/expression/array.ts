import { App, BoolExpr, Expr, HKT } from '../types'
export const $size = <T, D, C>(expr: Expr<T[], D, C>): Expr<number, D, C> => ({
  raw: () => ({ $size: expr.raw() }),
  eval: (d, c) => {
    const arr = expr.eval(d, c)
    if (!Array.isArray(arr)) return 0
    return arr.length
  },
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
  eval: (d, c) => {
    const arr = expr.eval(d, c)
    const extra = (x: T) => ({ [as]: x }) as Record<K, T>
    return arr?.filter(x => cond.eval(d, { ...c, ...extra(x) })) ?? null
  },
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
  eval: (d, c) => {
    const arr = expr.eval(d, c)
    const asc = order === 1
    return arr.sort((a, b) => {
      const comparison = String(a[sortBy]).localeCompare(String(b[sortBy]))
      return asc ? comparison : -comparison
    })
  },
})

export const $isArray = <T, D, C, F extends HKT<T | readonly T[]>>(
  expr: Expr<T | readonly T[], D & (App<F, T> | App<F, readonly T[]>), C>,
): BoolExpr<D & App<F, readonly T[]>, D & App<F, T>, C> => ({
  raw: () => ({ $isArray: expr.raw() }),
  eval: (d, c): d is D & App<F, readonly T[]> => Array.isArray(expr.eval(d, c)),
})

export const $array = <T, D, C>(...exprs: Expr<T, D, C>[]): Expr<T[], D, C> => ({
  raw: (): {} => exprs.map(x => x.raw()),
  eval: (d, c) => exprs.map(x => x.eval(d, c)),
})

export const $concat = <T, D, C>(...exprs: Expr<T[], D, C>[]): Expr<T[], D, C> => ({
  raw: () => ({ $concatArrays: exprs.map(x => x.raw()) }),
  eval: (d, c) => exprs.flatMap(x => x.eval(d, c)),
})

export const $first = <T, D, C>(expr: Expr<T[], D, C>): Expr<T | null, D, C> => ({
  raw: () => ({ $first: expr.raw() }),
  eval: (d, c) => {
    const val = expr.eval(d, c)
    return val == null ? null : val[0]
  },
})
export const $mergeObjects = <T extends object, D, C>(
  ...exprs: Expr<T, D, C>[]
): Expr<T, D, C> => ({
  raw: () => ({ $mergeObjects: exprs.map(x => x.raw()) }),
  eval: (d, c) => {
    const mergedArray = exprs.map(x => x.eval(d, c))
    return mergedArray.reduce((acc, obj) => ({ ...acc, ...obj }))
  },
})
