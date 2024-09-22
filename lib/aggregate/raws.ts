import type { App, Arr, HKT, J, RORec, RawObj, Rec, StrKey, jsonItem } from '../../types'
import type { Field } from '../field'
import type {
  Accumulators,
  AccumulatorsParam,
  Expr,
  FRawStages,
  LookupArgs,
  Query,
  RawStages,
} from '../types'
import type { Updater } from '../update'
import { id } from '../utils/json'
import { map } from '../utils/map-object'
import { asStages } from './prefix'

type s = string
export const $match1 =
  <Q extends J, T extends Q, C = unknown>(query?: Query<T, C>): FRawStages<Q, T, T, C, 1> =>
  f =>
    asStages(query ? [{ $match: query.raw(f<T>()) }] : [])

export const $set1 =
  <Q extends J, T extends Q, V extends Q, C = unknown>(updater: Updater<T, Q, T, V, C>): FRawStages<Q, T, V, C, 1> =>
  f =>
    asStages([
      {
        $set: Object.fromEntries(
          updater.raw(f<T>()).map(([k, v]) => [f().of(k.slice(1)).str(), v]),
        ),
      },
    ])

export const $project1 =
  <Q extends J, T extends Q>(projection: Record<StrKey<T>, 1>): FRawStages<Q, T, T, unknown, 1> =>
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
  <Q extends J, T extends Q, K extends s, U>(k: K): FRawStages<Q, T & Rec<K, Arr<U>>, T & Rec<K, U>> =>
  f =>
    asStages([{ $unwind: `$${f<Rec<K, Arr<U>>>().of(k).str()}` }])

export const $group1 =
  <
    Q extends J,
    T extends Q,
    ID extends jsonItem,
    K extends string,
    Acc extends Accumulators<T, K, RORec<K, jsonItem>, C>,
    C,
  >(
    id: Expr<ID, T, C>,
    args: Acc,
  ) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<unknown, App<F, T>, Rec<'_id', ID> & AccumulatorsParam<T, Acc, C, K>, C, 1> =>
    asStages([
      {
        $group: {
          _id: id.raw(f()).get(),
          ...map<Acc, K, RORec<K, RawObj>>(args, v => v.raw(f<T>())),
        },
      },
    ])

export const $documents1 =
  <Q extends J, T extends Q, C>(docs: Expr<Arr<T>, null, C>) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<unknown, null, App<F, T>, C, 1> =>
    asStages([{ $documents: docs.raw(f<never>()).get() }])

export const rawVars = <T, Ctx, C, V extends J>(
  vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T, C> },
  f: Field<V, T, unknown>,
) => Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.raw(f).get()]))

export const $simpleLookup1 =
  <Q extends J, T extends Q, U extends J, R, K extends s, Ctx, C = unknown>(
    args: LookupArgs<T, U, R, K, Ctx, C>,
  ): FRawStages<Q, T, T & Rec<K, Arr<U>>, C, 1> =>
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
