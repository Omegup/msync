import type { App, Arr, HKT, J, RORec, RawObj, Rec, StrKey, jsonItem } from '../../types'
import { Field } from '../field'
import type { Accumulator, Accumulators, Expr, FRawStages, LookupArgs, Query, RawStages } from '../types'
import type { Updater } from '../update'
import { id } from '../utils/json'
import { map } from '../utils/map-object'
import { asStages } from './prefix'

type s = string
export const $match1 =
  <T extends J, C = unknown>(query?: Query<T, C>): FRawStages<T, T, C, 1> =>
  f =>
    asStages(query ? [{ $match: query.raw(f<T>()) }] : [])

export const $set1 =
  <T extends J, V extends J, C = unknown>(updater: Updater<T, T, V, C>): FRawStages<T, V, C, 1> =>
  f =>
    asStages([
      {
        $set: Object.fromEntries(
          updater.raw(f<T>()).map(([k, v]) => [f().of(k.slice(1)).str(), v]),
        ),
      },
    ])

export const $project1 =
  <T extends J>(projection: Record<StrKey<T>, 1>): FRawStages<T, T, unknown, 1> =>
  f =>
    asStages([
      {
        $project: Object.fromEntries(
          Object.entries(projection).map(([k, v]) => [f<T>().of(k).str(), v]),
        ),
      },
    ])

export const $replaceWith1 =
  <T extends J, V extends J, C = unknown>(expr: Expr<V, T, C>): FRawStages<T, V, C, 1> =>
  f => {
    const parts = f<T>().str().split('.').filter(id)
    return asStages([
      { $replaceWith: parts.reduce((v, k) => ({ [k]: v }), expr.raw(f<T>()).get()) },
    ])
  }

export const $unwind1 =
  <T extends J, K extends s, U>(k: K): FRawStages<T & Rec<K, Arr<U>>, T & Rec<K, U>> =>
  f =>
    asStages([{ $unwind: `$${f<Rec<K, Arr<U>>>().of(k).str()}` }])

export const $group1 =
  <T extends J, ID extends J, K extends string, V extends RORec<K, jsonItem>, C>(
    id: Expr<ID, T, C>,
    args: { readonly [P in K]: Accumulator<T, V[P], C> },
  ) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<App<F, T>, Rec<'_id', ID> & V> =>
    asStages([
      {
        $group: {
          _id: id.raw(f()).get(),
          ...map<Accumulators<T, K, V, C>, K, RORec<K, RawObj>>(args, v => v.raw(f<T>())),
        },
      },
    ])

export const $documents1 =
  <T extends J, C>(docs: Expr<Arr<T>, null, C>) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<null, App<F, T>, C, 1> =>
    asStages([{ $documents: docs.raw(f<never>()).get() }])


export const $simpleLookup1 =
  <T extends J, U extends J, R, K extends s, Ctx, C = unknown>(
    args: LookupArgs<T, U, R, K, Ctx, C>,
  ): FRawStages<T, T & Rec<K, Arr<U>>, C, 1> =>
  f => {
    const { coll, k, pipeline, vars } = args
    return asStages([
      {
        $lookup: {
          ...(coll && { from: coll.collectionName }),
          as: f<Rec<K, Arr<U>>>().of(k).str(),
          let: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.raw(f<T>()).get()])),
          pipeline,
        },
      },
    ])
  }
