import type { Timestamp } from 'mongodb'
import type { Arr, ConstHKT, N, O, RORec, StrKey, jsonItem, rawItem } from '../../types'
import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'
import type { ExprHKT, ExprsExact } from './concat'
import { mapExactToObject } from '../utils/map-object'

export const val = <T extends rawItem>(val: T): Expr<T, unknown> =>
  asExpr({
    raw: () =>
      asExprRaw<T, unknown, unknown>(
        (val && typeof val === 'object' && !(val instanceof Date) ) || (typeof val === 'string' && val[0] === '$')
          ? { $literal: val }
          : val,
      ),
  })

export const current: Expr<Timestamp, unknown> = asExpr({
  raw: () => asExprRaw<Timestamp, unknown, unknown>('$$CLUSTER_TIME'),
})
export const $let = <T, D, C, V extends RORec<string, jsonItem>>(
  vars: ExprsExact<V, D, C>,
  inExpr: Expr<T, D, C & V>,
) =>
  asExpr<T, D, C>({
    raw: f =>
      asExprRaw({
        $let: {
          vars: mapExactToObject<V, ExprHKT<D, C>, ConstHKT<rawItem>>(vars, v => v.raw(f).get()),
          in: inExpr.raw(f).get(),
        },
      }),
  })

export const nil = val(null)

export const $getField: {
  <T, K extends StrKey<T>, D, C = unknown>(expr: Expr<T, D, C>, field: K): Expr<T[K], D, C>
  <T, K extends StrKey<T>, D, C = unknown>(
    expr: Expr<T | N, D, C>,
    field: K,
  ): Expr<T[K] | null, D, C>
} = <T, K extends StrKey<T>, D, C = unknown>(expr: Expr<T | N, D, C>, field: K) =>
  asExpr<T[K] | null, D, C>({
    raw: f =>
      asExprRaw({
        $getField: {
          field: field,
          input: expr.raw(f).get(),
        },
      }),
  })

export type NoRaw<T> =
  T extends Arr<infer U>
    ? NoRaw<U>[]
    : T extends readonly unknown[]
      ? { [K in keyof T]: NoRaw<T[K]> }
      : T extends O
        ? { [K in StrKey<T>]: NoRaw<T[K]> }
        : T
export type RONoRaw<T> =
  T extends Arr<infer U>
    ? readonly RONoRaw<U>[]
    : T extends readonly unknown[]
      ? { readonly [K in keyof T]: RONoRaw<T[K]> }
      : T extends O
        ? { readonly [K in StrKey<T>]: RONoRaw<T[K]> }
        : T
export const func = <T extends jsonItem, A extends readonly jsonItem[], D, C = unknown>(
  f: (...args: NoRaw<A>) => RONoRaw<T>,
  ...args: { [X in keyof A]: Expr<A[X], D, C> }
) =>
  asExpr<T, D, C>({
    raw: field =>
      asExprRaw({
        $function: {
          body: f.toString(),
          args: args.map(x => x.raw(field).get()),
          lang: 'js',
        },
      }),
  })

export const rand = function () {
  const s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array(17)
    .fill(0)
    .map(() => s[Math.floor(Math.random() * 62)])
    .join('')
}
export const $rand = func(rand)
