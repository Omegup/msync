import type { Timestamp } from '../../types'
import type { Arr, ConstHKT, N, O, StrKey, jsonItem, notObj, rawItem } from '../../types'
import { ctx } from '../field'
import type { Expr } from '../types'
import { mapExactToObject } from '../utils/map-object'
import { $reduce } from './array'
import { floor, multiply } from './arith'
import type { ExprHKT, ExprsExact } from './concat'
import { $substr, concat } from './concat'
import { asExpr, asExprRaw } from './expr-base'
import { range } from './range'

export const val = <T extends rawItem>(val: T): Expr<T, unknown> =>
  asExpr({
    raw: () =>
      asExprRaw<T, unknown, unknown>(
        (val && typeof val === 'object' && !(val instanceof Date)) ||
          (typeof val === 'string' && val[0] === '$')
          ? { $literal: val }
          : val,
      ),
  })

export const current: Expr<Timestamp, unknown> = asExpr({
  raw: () => asExprRaw<Timestamp, unknown, unknown>('$$CLUSTER_TIME'),
})
export const $rand: Expr<number, unknown> = asExpr({
  raw: () => asExprRaw<number, unknown, unknown>({ $rand: {} }),
})
export const rand = $reduce<number, string, unknown, unknown>(
  range(val(0), val(17)),
  val(''),
  concat(
    ctx<string>()('value').expr(),
    $substr(
      val('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
      floor(multiply($rand, val(62))),
      val(1),
    ),
  ),
)
export const $let = <T, D, C, V extends object>(
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
  <T, K extends StrKey<T>, D, C = unknown>(expr: Expr<T, D, C>, field: K | Expr<K, D, C>): Expr<T[K], D, C>
  <T, K extends StrKey<T>, D, C = unknown>(
    expr: Expr<T | N, D, C>,
    field: K | Expr<K, D, C>,
  ): Expr<T[K] | null, D, C>
} = <T, K extends StrKey<T>, D, C = unknown>(expr: Expr<T | N, D, C>, field: K | Expr<K, D, C>) =>
  asExpr<T[K] | null, D, C>({
    raw: f =>
      asExprRaw({
        $getField: {
          field: typeof field === 'string' ? field : field.raw(f).get(),
          input: expr.raw(f).get(),
        },
      }),
  })

export type AddO<T> = T extends notObj ? T : T extends Array<infer U> ? Arr<AddO<U>> : O<{[K in keyof T]: AddO<T[K]>}> 

export const func = <T extends jsonItem, A extends readonly jsonItem[], D, C = unknown>(
  f: (...args: A) => T,
  ...args: { [X in keyof A]: Expr<AddO<A[X]>, D, C> }
) =>
  asExpr<AddO<T>, D, C>({
    raw: field =>
      asExprRaw({
        $function: {
          body: f.toString(),
          args: args.map(x => x.raw(field).get()),
          lang: 'js',
        },
      }),
  })

