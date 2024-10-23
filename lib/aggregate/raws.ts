import type { App, Arr, ConstHKT, HKT, J, RORec, RawObj, Rec, StrKey, jsonItem } from '../../types'
import type { Field } from '../field'
import type {
  AccumulatorHKT,
  Accumulators,
  Expr,
  FRawStages,
  LookupArgs,
  Query,
  RawStages,
} from '../types'
import type { Updater } from '../update'
import { id } from '../utils/json'
import { mapExactToObject } from '../utils/map-object'
import { asStages } from './prefix'

type s = string
export const $match1 =
  <T extends J, C = unknown>(query?: Query<T, C>): FRawStages<T, T, T, C, 1> =>
  f =>
    asStages(query ? [{ $match: query.raw(f<T>()) }] : [])

export const $set1 =
  <Q, T extends Q & J, V extends Q & J, C = unknown>(
    updater: Updater<T, T, V, C>,
  ): FRawStages<Q, T, V, C, 1> =>
  f =>
    asStages([
      {
        $set: Object.fromEntries(
          updater.raw(f<T>()).map(([k, v]) => [f().of(k.slice(1)).str(), v]),
        ),
      },
    ])

export const $project1 =
  <T extends J>(projection: Record<StrKey<T>, 1>): FRawStages<T, T, T, unknown, 1> =>
  f =>
    asStages([
      {
        $project: Object.fromEntries(
          Object.entries(projection).map(([k, v]) => [f<T>().of(k).str(), v]),
        ),
      },
    ])

export const $replaceWith1 =
  <T extends J, V extends J, C = unknown>(expr: Expr<V, T, C>): FRawStages<J, T, V, C, 1> =>
  f => {
    const parts = f<T>().str().split('.').filter(id)
    return asStages([
      { $replaceWith: parts.reduce((v, k) => ({ [k]: v }), expr.raw(f<T>()).get()) },
    ])
  }

export const $unwind1 =
  <T extends J, K extends s, U>(k: K): FRawStages<T, T & Rec<K, Arr<U>>, T & Rec<K, U>> =>
  f =>
    asStages([{ $unwind: `$${f<Rec<K, Arr<U>>>().of(k).str()}` }])

export const $group1 =
  <T extends J, ID extends jsonItem, V extends RORec<string, jsonItem>, C>(
    id: Expr<ID, T, C>,
    args: Accumulators<T, V, C>,
  ) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<J, App<F, T>, Rec<'_id', ID> & V, C, 1> =>
    asStages([
      {
        $group: {
          _id: id.raw(f()).get(),
          ...mapExactToObject<V, AccumulatorHKT<T, C>, ConstHKT<RawObj>>(args, v => v.raw(f<T>())),
        },
      },
    ])

export const $documents1 =
  <Q extends J, T extends Q, C>(docs: Expr<Arr<T>, unknown, C>) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<unknown, null, App<F, T>, C, 1> =>
    asStages([{ $documents: docs.raw(f<never>()).get() }])

export const rawVars = <T, Ctx, C, V extends J>(
  vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T, C> },
  f: Field<V, T, unknown>,
) => Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.raw(f).get()]))

export const $simpleLookup1 =
  <T extends J, U extends J, R, K extends s, Ctx, C = unknown>(
    args: LookupArgs<T, U, R, K, Ctx, C>,
  ): FRawStages<T, T, T & Rec<K, Arr<U>>, C, 1> =>
  f => {
    const { coll, k, pipeline, vars } = args
    return asStages([
      {
        $lookup: {
          ...(coll && { from: coll.collectionName }),
          as: f<Rec<K, Arr<U>>>().of(k).str(),
          let: rawVars(vars, f<T>()),
          pipeline,
        },
      },
    ])
  }
