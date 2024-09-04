import type { Timestamp } from 'mongodb'
import type { jsonItem, rawItem } from '../../types'
import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'
export { ctx } from '../field'

export const val = <T extends rawItem>(val: T): Expr<T, unknown> =>
  asExpr({
    raw: () =>
      asExprRaw<T, unknown, unknown>(
        (val && typeof val === 'object') || (typeof val === 'string' && val[0] === '$')
          ? { $literal: val }
          : val,
      ),
  })

export const now: Expr<Timestamp, unknown> = asExpr({
  raw: () => asExprRaw<Timestamp, unknown, unknown>('$$NOW'),
})

export const nil = val(null)


export const $getField = <T, K extends string & keyof T, D, C = unknown>(
  expr: Expr<T | null, D, C>,
  field: K,
) =>
  asExpr<T[K] | null, D, C>({
    raw: f =>
      asExprRaw({
        $getField: {
          field: field,
          input: expr.raw(f),
        },
      }),
  })

export const func = <T extends jsonItem, A extends readonly jsonItem[], D, C = unknown>(
  f: (...args: A) => T,
  ...args: { [X in keyof A]: Expr<A[X], D, C> }
) =>
  asExpr<T, D, C>({
    raw: f =>
      asExprRaw({
        $function: {
          body: f.toString(),
          args: args.map(x => x.raw(f)),
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
