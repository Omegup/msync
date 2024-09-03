import type { Timestamp } from 'mongodb'
import type { RORec, jsonItem, rawItem } from '../../types'
import type { Expr } from '../types'

export const val = <T extends rawItem, D, C = unknown>(val: () => T): Expr<T, D, C> => ({
  raw: () => ({ $literal: val() }),
})

export const now: Expr<Timestamp, unknown> = {
  raw: () => '$$NOW',
}

export const nil = val(() => null)

export const ctx = <K extends string, V>(k: K): Expr<V, unknown, RORec<K, V>> => ({
  raw: () => `$$${k}`,
})

export const $getField = <T, K extends string & keyof T, D, C = unknown>(
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

export const func = <T extends jsonItem, A extends readonly jsonItem[], D, C = unknown>(
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
