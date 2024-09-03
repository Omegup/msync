import type { Arr, JsonObj, ReadonlyCollection, Rec, WriteonlyCollection } from '../../types'
import { root } from '../field'
import type { Expr, Query, RawStages } from '../types'
import { type Updater } from '../update'
import { asStages } from './prefix'

type s = string
type J = JsonObj

export const $match_ = <T extends J, C = unknown>(query?: Query<T, C>) =>
  asStages<T, T, C>(query ? [{ $match: query.raw(root()) }] : [])

export const $set_ = <T, V, C = unknown>(updater: Updater<T, T, V, C>) =>
  asStages<T, V, C>([{ $set: updater.raw }])

export const $project_ = <T>(projection: Record<keyof T, 1>) =>
  asStages<T, T>([{ $project: projection }])

export const $replaceWith_ = <T extends J, V>(expr: Expr<V, T>) =>
  asStages<T, V>([{ $replaceWith: expr.raw(root()) }])

export const $simpleMerge_ = <T, K extends keyof T>(out: WriteonlyCollection<T>) =>
  asStages<Pick<T, K>, never>([{ $merge: out.collectionName }])

export const $unwind_ = <T, K extends s, U>(k: K): RawStages<T & Rec<K, Arr<U>>, T & Rec<K, U>> =>
  asStages<T & Rec<K, Arr<U>>, T & Rec<K, U>>([{ $unwind: `$${k}` }])

export const $simpleLookup_ = <T extends J, U extends J, R, K extends s, Ctx, C>(args: {
  coll: ReadonlyCollection<R>
  pipeline: RawStages<R, U, Ctx & C>
  vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T, C> }
  k: K
}) => {
  const { coll, k, pipeline, vars } = args
  return asStages<T, T & Rec<K, Arr<U>>>([
    {
      $lookup: {
        from: coll.collectionName,
        as: k,
        let: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.raw(root())])),
        pipeline,
      },
    },
  ])
}
