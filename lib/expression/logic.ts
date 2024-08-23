import type { App, HKT, jsonItem } from '../../types'
import type { BoolExpr, Expr } from '../types'
import { val } from './val'

export const ite = (<T, D1, D2, C>(
  cond: BoolExpr<D1, D2, C>,
  then: Expr<T, D1, C>,
  orelse: Expr<T, D2, C>,
): Expr<T, D1 | D2, C> => {
  return {
    raw: () => ({
      $cond: { if: cond.raw(), then: then.raw(), else: orelse.raw() },
    }),
  }
}) as {
  <T, D, C>(cond: Expr<boolean, D, C>, then: Expr<T, D, C>, orelse: Expr<T, D, C>): Expr<T, D, C>
  <T, D1, D2, C>(
    cond: BoolExpr<D1, D2, C>,
    then: Expr<T, D1, C>,
    orelse: Expr<T, D2, C>,
  ): Expr<T, D1 | D2, C>
}

export const eq =
  <T, D, C>(a: Expr<T, D, C>) =>
  (b: Expr<T, D, C>): BoolExpr<boolean, D, C> => ({
    raw: () => ({ $eq: [a.raw(), b.raw()] }),
  })

export const eqTyped =
  <T1 extends Dom, T2 extends Dom, F extends HKT<Dom>, C, Dom = unknown>(
    a: Expr<T1 | T2, App<F, T1 | T2>, C>,
  ) =>
  (b: Expr<T1, App<F, T1 | T2>, C>): BoolExpr<App<F, T1>, App<F, T2>, C> => ({
    raw: () => ({ $eq: [a.raw(), b.raw()] }),
  })

export const ne =
  <T, K, D, C>(a: Expr<T, D, C>) =>
  (b: Expr<K, D, C>): Expr<boolean, D, C> => ({
    raw: () => ({ $ne: [a.raw(), b.raw()] }),
  })

export const $ifNull = <R, D, C>(
  ...expr: [...Expr<R | null | undefined, D, C>[], Expr<R | null | undefined, D, C>]
): Expr<R, D, C> => ({
  raw: () => ({ $ifNull: expr.map(e => e.raw()) }),
})

export const exprMapVal = <K extends string, T extends Partial<Record<K, jsonItem>>, D, C>(
  expr: Expr<K, D, C>,
  map: { [P in K]: Expr<T[P], D, C> },
  or?: Expr<T[K], D, C>,
): Expr<T[K & keyof T], D, C> => ({
  raw: () => ({
    $switch: {
      branches: Object.entries(map).map(([k, v]) => ({
        case: { $eq: [expr.raw(), { $literal: k }] },
        then: v.raw(),
      })),
      ...(or && { default: or.raw() }),
    },
  }),
})

export const mapVal = <K extends string, T extends Partial<Record<K, jsonItem>>, D, C>(
  expr: Expr<K, D, C>,
  map: T,
  or: T[K],
): Expr<T[K & keyof T], D, C> =>
  exprMapVal<K, T, D, C>(
    expr,
    Object.fromEntries(Object.entries(map as Pick<T, K>).map(([k, v]) => [k, val(() => v)])),
    val(() => or),
  )

export const setField = <K extends string, T, V, D, C>({
  field,
  input,
  value,
}: {
  field: Expr<K, D, C>
  input: Expr<T, D, C>
  value: Expr<V, D, C>
}): Expr<T & Record<K, V>, D, C> => ({
  raw: () => ({
    $setField: {
      field: field.raw(),
      input: input.raw(),
      value: value.raw(),
    },
  }),
})
