import type { json } from '../../types'
import type { Query } from '../types'

export const combine =
  (op: string) =>
  <T extends json>(...args: Query<T>[]): Query<T> => ({
    raw: prefix => ({ [op]: args.map(x => x.raw(prefix)) }),
    expr: ()=>0
  })

export const $and = combine('$and')
export const $nor = combine('$nor')
export const $or = combine('$or')
export const sub = <T extends Record<K, json | null>, K extends string & keyof T>(
  { raw }: Query<Exclude<T[K], null>>,
  k: K,
): Query<T> => ({
  raw: prefix => raw(field => prefix(`${k}.${field}`)),
})
