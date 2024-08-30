import type { App, HKT, JsonObj, jsonItem, rawItem } from '../../types'
import type { Field } from '../field'
import type { BoolExpr, Expr } from '../types'
import { val } from './val'

export const ite = (<T, D1, D2, C>(
  cond: BoolExpr<D1, D2, C>,
  then: Expr<T, D1, C>,
  orelse: Expr<T, D2, C>,
): Expr<T, D1 | D2, C> => {
  return {
    raw: <DeltaD extends JsonObj>(f: Field<DeltaD, D1 | D2>) => ({
      $cond: {
        if: cond.raw(f),
        then: then.raw(f as Field<DeltaD, D1>),
        else: orelse.raw(f as Field<DeltaD, D2>),
      },
    }),
  }
}) as {
  <T, D, C = unknown>(
    cond: Expr<boolean, D, C>,
    then: Expr<T, D, C>,
    orelse: Expr<T, D, C>,
  ): Expr<T, D, C>
  <T, R1 extends Dom, R2 extends Dom, F extends HKT<Dom>, Dom = jsonItem, C = unknown>(
    cond: BoolExpr<App<F, R1>, App<F, R2>, C>,
    then: Expr<T, App<F, R1>, C>,
    orelse: Expr<T, App<F, R2>, C>,
  ): Expr<T, App<F, R1 | R2>, C>
}

export const eq =
  <T, D, C>(a: Expr<T, D, C>) =>
  (b: Expr<T, D, C>): Expr<boolean, D, C> => ({
    raw: f => ({ $eq: [a.raw(f), b.raw(f)] }),
  })

export const sub = <T, D, C, DeltaD extends JsonObj>(a: Expr<T, D, C>, f: Field<DeltaD, D>): Expr<T, DeltaD, C> => ({raw: g=> a.raw(g.of(f)) })

export const eqTyped = <T1 extends Dom, T2 extends Dom, F extends HKT<Dom>, C, Dom = jsonItem>(
  a: Expr<T1 | T2, App<F, T1 | T2>, C>,
  b: Expr<T1, App<F, T1 | T2>, C>,
): BoolExpr<App<F, T1>, App<F, T2>, C> => ({
  raw: f => ({ $eq: [a.raw(f), b.raw(f)] }),
})

export const ne =
  <T, K, D, C>(a: Expr<T, D, C>) =>
  (b: Expr<K, D, C>): Expr<boolean, D, C> => ({
    raw: f => ({ $ne: [a.raw(f), b.raw(f)] }),
  })

export const $ifNull = <R, D, C>(
  ...expr: [...Expr<R | null | undefined, D, C>[], Expr<R | null | undefined, D, C>]
): Expr<R, D, C> => ({
  raw: f => ({ $ifNull: expr.map(e => e.raw(f)) }),
})

export const exprMapVal = <K extends string, T extends Partial<Record<K, rawItem>>, D, C>(
  expr: Expr<K, D, C>,
  map: { [P in K]: Expr<T[P], D, C> },
  or?: Expr<T[K], D, C>,
): Expr<T[K & keyof T], D, C> => ({
  raw: f => ({
    $switch: {
      branches: Object.entries(map).map(([k, v]) => ({
        case: { $eq: [expr.raw(f), { $literal: k }] },
        then: v.raw(f),
      })),
      ...(or && { default: or.raw(f) }),
    },
  }),
})

export const mapVal = <K extends string, T extends Partial<Record<K, rawItem>>, D, C>(
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
  raw: f => ({
    $setField: {
      field: field.raw(f),
      input: input.raw(f),
      value: value.raw(f),
    },
  }),
})
