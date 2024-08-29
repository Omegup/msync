import type { jsonItem, rawItem } from '../../types'
import type { Expr } from '../types'

export const val = <T extends rawItem, D, C = object>(val: () => T): Expr<T, D, C> => ({
  raw: () => ({ $literal: val() }),
})
export const $getField = <T, K extends string & keyof T, D, C = object>(
  expr: Expr<T | null, D, C>,
  field: K,
): Expr<T[K] | null, D, C> => ({
  raw: f => ({
    $getField: {
      field: field,
      input: expr.raw(f),
    },
  }),
})

export const func = <T extends jsonItem, A extends readonly jsonItem[], D, C = object>(
  f: (...args: A) => T,
  ...args: { [X in keyof A]: Expr<A[X], D, C> }
): Expr<T, D, C> => ({
  raw: f => ({
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
