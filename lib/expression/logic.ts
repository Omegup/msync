import type { App, HKT, J, jsonItem, rawItem } from '../../types'
import type { Field, Path } from '../field'
import type { BoolExpr, Expr } from '../types'
import { asBoolExpr, asExpr, asExprRaw } from './expr-base'
import { val } from './val'

export const ite = (<T, D1, D2, C>(
  cond: BoolExpr<D1, D2, C>,
  then: Expr<T, D1 | D2, C>,
  orelse: Expr<T, D2 | D2, C>,
) =>
  asExpr<T, D1 | D2, C>({
    raw: <DeltaD extends J, Ctx>(f: Field<DeltaD, D1 | D2, Ctx>) =>
      asExprRaw<T, DeltaD, C & Ctx>({
        $cond: {
          if: cond.raw(f).get(),
          then: then.raw(f as Field<DeltaD, D1>).get(),
          else: orelse.raw(f as Field<DeltaD, D2>).get(),
        },
      }),
  })) as {
  <T, D, C = unknown>(
    cond: Expr<boolean, D, C>,
    then: Expr<T, D, C>,
    orelse: Expr<T, D, C>,
  ): Expr<T, D, C>
  <T, R1, R2, F extends HKT<R1 | R2>, C = unknown>(
    cond: BoolExpr<App<F, R1>, App<F, R2>, C>,
    then: Expr<T, App<F, R1>, C>,
    orelse: Expr<T, App<F, R2>, C>,
  ): Expr<T, App<F, R1 | R2>, C>
}

export const eq =
  <T, D, C>(a: Expr<T, D, C>) =>
  (b: Expr<T, D, C>) =>
    asExpr<boolean, D, C>({
      raw: f => asExprRaw({ $eq: [a.raw(f).get(), b.raw(f).get()] }),
    })

export const sub = <T, D, Ctx, P extends J>(a: Expr<T, D, Ctx>, f: Path<P, D, Ctx>) =>
  asExpr<T, P, Ctx>({ raw: g => asExprRaw(a.raw(g.with(f)).get()) })

export const eqTyped = <
  T1 extends Dom,
  T2 extends Dom,
  F extends HKT<Dom>,
  C = unknown,
  Dom = jsonItem,
>(
  a: Expr<T1 | T2, App<F, T1 | T2>, C>,
  b: Expr<T1, App<F, T1 | T2>, C>,
): BoolExpr<App<F, T1>, App<F, T2>, C> =>
  asBoolExpr({
    raw: <DeltaD extends J>(f: Field<DeltaD, App<F, T1> | App<F, T2>>) =>
      asExprRaw<never, DeltaD, C>({ $eq: [a.raw(f).get(), b.raw(f).get()] }),
  })

export const ne =
  <T, K, D, C>(a: Expr<T, D, C>) =>
  (b: Expr<K, D, C>) =>
    asExpr<boolean, D, C>({
      raw: f => asExprRaw({ $ne: [a.raw(f).get(), b.raw(f).get()] }),
    })

export const $ifNull = <R, D, C>(
  ...expr: [...Expr<R | null | undefined, D, C>[], Expr<R, D, C>]
) =>
  asExpr<R, D, C>({
    raw: f => asExprRaw({ $ifNull: expr.map(e => e.raw(f).get()) }),
  })

export const exprMapVal = <K extends string, T extends Partial<Record<K, rawItem>>, D, C>(
  expr: Expr<K, D, C>,
  map: { readonly [P in K]: Expr<T[P], D, C> },
  or?: Expr<T[K], D, C>,
) =>
  asExpr<T[K & keyof T], D, C>({
    raw: f =>
      asExprRaw({
        $switch: {
          branches: Object.entries(map).map(([k, v]) => ({
            case: { $eq: [expr.raw(f).get(), { $literal: k }] },
            then: v.raw(f).get(),
          })),
          ...(or && { default: or.raw(f).get() }),
        },
      }),
  })

export const mapVal = <K extends string, T extends Partial<Record<K, rawItem>>, D, C>(
  expr: Expr<K, D, C>,
  map: T,
  or: T[K],
): Expr<T[K], D, C> =>
  exprMapVal<K, T, D, C>(
    expr,
    Object.fromEntries<{ readonly [P in K]: Expr<T[P], D, C> }>(
      Object.entries(map as Pick<T, K>).map(([k, v]) => [k, val(v)]),
    ),
    val(or),
  )

export const setField = <K extends string, T, V, D, C>({
  field,
  input,
  value,
}: {
  field: Expr<K, D, C>
  input: Expr<T, D, C>
  value: Expr<V, D, C>
}) =>
  asExpr<T & Record<K, V>, D, C>({
    raw: f =>
      asExprRaw({
        $setField: {
          field: field.raw(f).get(),
          input: input.raw(f).get(),
          value: value.raw(f).get(),
        },
      }),
  })
