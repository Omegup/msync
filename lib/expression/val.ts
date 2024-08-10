import { Expr, jsonItem } from '../types'

export const val = <T extends jsonItem, D, C = object>(val: () => T): Expr<T, D, C> => ({
  raw: () => ({ $literal: val() }),
  eval: val,
})
export const $getField = <T, K extends string & keyof T, D, C = object>(
  expr: Expr<T | null, D, C>,
  field: K,
): Expr<T[K] | null, D, C> => ({
  raw: () => ({
    $getField: {
      field: field,
      input: expr.raw(),
    },
  }),
  eval: (d, c) => {
    const item = expr.eval(d, c)
    return item?.[field] ?? null
  },
})

export const func = <T extends jsonItem, A extends readonly jsonItem[], D, C = object>(
  f: (...args: A) => T,
  ...args: { [X in keyof A]: Expr<A[X], D, C> }
): Expr<T, D, C> => ({
  raw: () => ({
    $function: {
      body: f.toString(),
      args: args.map(x => x.raw()),
      lang: 'js',
    },
  }),
  eval: (d, c) => {
    const arr = args.map(x => x.eval(d, c)) as readonly jsonItem[] as A
    return f(...arr)
  },
})

export const rand = function () {
  const s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array(17)
    .fill(0)
    .map(() => s[Math.floor(Math.random() * 62)])
    .join('')
}
export const $rand = func(rand)
