import type { App, Arr, HKT, J, ReadonlyCollection, Rec, StrKey } from '../../types'
import { Field } from '../field'
import type { Expr, Query, RawStages } from '../types'
import type { Updater } from '../update'
import { id } from '../utils/json'
import { asStages } from './prefix'

type s = string

export const $match1 =
  <T extends J, C = unknown>(query?: Query<T, C>) =>
  <F extends HKT<J, J>>(f: <T extends J>() => Field<App<F, T>, T>) =>
    asStages<App<F, T>, App<F, T>, C>(query ? [{ $match: query.raw(f<T>()) }] : [])

export const $set1 =
  <T extends J, V extends J, C = unknown>(updater: Updater<T, T, V, C>) =>
  <F extends HKT<J, J>>(f: <T extends J>() => Field<App<F, T>, T>) =>
    asStages<App<F, T>, App<F, V>, C>([
      { $set: Object.fromEntries(updater.raw(f<T>()).map(([k, v]) => [k.slice(1), v])) },
    ])

export const $project1 =
  <T extends J>(projection: Record<StrKey<T>, 1>) =>
  <F extends HKT<J, J>>(f: <T extends J>() => Field<App<F, T>, T>) =>
    asStages<App<F, T>, App<F, T>>([
      {
        $project: Object.fromEntries(
          Object.entries(projection).map(([k, v]) => [f<T>().of(k).str(), v]),
        ),
      },
    ])

export const $replaceWith1 =
  <T extends J, V extends J, C = unknown>(expr: Expr<V, T, C>) =>
  <F extends HKT<J, J>>(f: <T extends J>() => Field<App<F, T>, T>) => {
    const parts = f<T>().str().split('.').filter(id)
    return asStages<App<F, T>, App<F, V>, C>([
      { $replaceWith: parts.reduce((v, k) => ({ [k]: v }), expr.raw(f<T>()).get()) },
    ])
  }

export const $unwind1 =
  <T, K extends s, U>(k: K) =>
  <F extends HKT<J, J>>(f: <T extends J>() => Field<App<F, T>, T>) =>
    asStages<App<F, T & Rec<K, Arr<U>>>, App<F, T & Rec<K, U>>>([
      { $unwind: `$${f<Rec<K, Arr<U>>>().of(k).str()}` },
    ])

export const $simpleLookup1 =
  <T extends J, U extends J, R, K extends s, Ctx, C>(args: {
    coll: ReadonlyCollection<R>
    pipeline: RawStages<R, U, Ctx & C>
    vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T, C> }
    k: K
  }) =>
  <F extends HKT<J, J>>(f: <T extends J>() => Field<App<F, T>, T>) => {
    const { coll, k, pipeline, vars } = args
    return asStages<App<F, T>, App<F, T & Rec<K, Arr<U>>>, C>([
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

