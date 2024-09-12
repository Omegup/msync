import type { Arr, J, ReadonlyCollection, Rec, StrKey } from '../../types'
import type { Expr, FRawStages, Query, RawStages } from '../types'
import type { Updater } from '../update'
import { id } from '../utils/json'
import { asStages } from './prefix'

type s = string

export const $match1 =
  <T extends J, C = unknown>(query?: Query<T, C>): FRawStages<T, T, C> =>
  f =>
    asStages(query ? [{ $match: query.raw(f<T>()) }] : [])

export const $set1 =
  <T extends J, V extends J, C = unknown>(updater: Updater<T, T, V, C>): FRawStages<T, V, C> =>
  f =>
    asStages([{ $set: Object.fromEntries(updater.raw(f<T>()).map(([k, v]) => [k.slice(1), v])) }])

export const $project1 =
  <T extends J>(projection: Record<StrKey<T>, 1>): FRawStages<T, T> =>
  f =>
    asStages([
      {
        $project: Object.fromEntries(
          Object.entries(projection).map(([k, v]) => [f<T>().of(k).str(), v]),
        ),
      },
    ])

export const $replaceWith1 =
  <T extends J, V extends J, C = unknown>(expr: Expr<V, T, C>): FRawStages<T, V, C> =>
  f => {
    const parts = f<T>().str().split('.').filter(id)
    return asStages([
      { $replaceWith: parts.reduce((v, k) => ({ [k]: v }), expr.raw(f<T>()).get()) },
    ])
  }

export const $unwind1 =
  <T, K extends s, U>(k: K): FRawStages<T & Rec<K, Arr<U>>, T & Rec<K, U>> =>
  f =>
    asStages([{ $unwind: `$${f<Rec<K, Arr<U>>>().of(k).str()}` }])

export const $simpleLookup1 =
  <T extends J, U extends J, R, K extends s, Ctx, C>(args: {
    coll: ReadonlyCollection<R>
    pipeline: RawStages<R, U, Ctx & C>
    vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T, C> }
    k: K
  }): FRawStages<T, T & Rec<K, Arr<U>>, C> =>
  f => {
    const { coll, k, pipeline, vars } = args
    return asStages([
      {
        $lookup: {
          from: coll.collectionName,
          as: f<Rec<K, Arr<U>>>().of(k).str(),
          let: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.raw(f<T>()).get()])),
          pipeline,
        },
      },
    ])
  }
