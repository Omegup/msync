import type {
  App,
  Arr,
  ConstHKT,
  HKT,
  IdHKT,
  O,
  RORec,
  RawObj,
  Rec,
  StrKey,
  rawItem,
} from '../../types'
import type { ExprHKT, ExprsExact } from '../expression/concat'
import { root, type Field } from '../field'
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
import { mapExactToObject, type ExactKeys } from '../utils/map-object'
import { asStages } from './prefix'

type s = string
export const $match1 =
  <T extends O, C = unknown>(query?: Query<T, C>): FRawStages<T, T, T, C> =>
  f =>
    asStages(query ? [{ $match: query.raw(f<T>()) }] : [])

export const $set1 =
  <Q, T extends Q & O, V extends Q & O, C = unknown>(
    updater: Updater<T, T, V, C>,
  ): FRawStages<Q, T, V, C, 1> =>
  f =>
    asStages([
      {
        $set: Object.fromEntries(
          updater.raw(f<T>()).map(([k, v]) => [
            f<T>()
              .of(k.slice(1) as keyof T)
              .str(),
            v,
          ]),
        ),
      },
    ])

export const $project1 = <T extends O, K extends StrKey<T>>(
  projection: ExactKeys<K>,
): RawStages<T, T, T, unknown, 1> =>
  asStages([
    {
      $project: mapExactToObject<RORec<K, 1>, IdHKT, ConstHKT<1>>(projection, () => 1),
    },
  ])

export const $replaceWith1 =
  <T extends O, V extends O, C = unknown>(expr: Expr<V, T, C>): FRawStages<O, T, V, C, 1> =>
  f => {
    const parts = f<T>().str().split('.').filter(id)
    return asStages([
      { $replaceWith: parts.reduce((v, k) => ({ [k]: v }), expr.raw(f<T>()).get()) },
    ])
  }

export const $unwind1 =
  <T extends O, K extends s, R>(k: K): FRawStages<T, T & Rec<K, Arr<R>>, T & Rec<K, R>> =>
  f =>
    asStages([{ $unwind: `$${f<Rec<K, Arr<R>>>().of(k).str()}` }])

export const $group1 =
  <T extends O, ID, V extends O, C>(id: Expr<ID, T, C>, args: Accumulators<T, V, C>) =>
  <F extends HKT<O, O>>(
    f: <T extends O>() => Field<App<F, T>, T>,
  ): RawStages<O, App<F, T>, Rec<'_id', ID> & V, C, 1> =>
    asStages([
      {
        $group: {
          _id: id.raw(f()).get(),
          ...mapExactToObject<V, AccumulatorHKT<T, C>, ConstHKT<RawObj>>(args, v => v.raw(f<T>())),
        },
      },
    ])

export const $documents1 =
  <Q extends O, T extends Q & O, C>(docs: Expr<Arr<T>, unknown, C>) =>
  <F extends HKT<O, O>>(
    f: <T extends O>() => Field<App<F, T>, T>,
  ): RawStages<unknown, null, App<F, T>, C, 1> =>
    asStages([{ $documents: docs.raw(f<never>()).get() }])

export const rawVars = <T, Ctx, C, V extends O>(
  vars: ExprsExact<Ctx, T, C>,
  f: Field<V, T, unknown>,
) => mapExactToObject<Ctx, ExprHKT<T, C>, ConstHKT<rawItem>>(vars, v => v.raw(f).get())

export const $simpleLookup1 =
  <T extends O, U extends O, R, K extends s, Ctx, C = unknown, S = string>(
    args: LookupArgs<T, U, R, K, Ctx, C, S>,
  ): FRawStages<T, T, T & Rec<K, Arr<U>>, C, 1> =>
  f => {
    const { coll, k, vars, fields, ...etc } = args
    return asStages([
      {
        $lookup: {
          ...(coll && { from: coll.collectionName }),
          ...(fields && {
            localField: f<T>().with(fields.local).str(),
            foreignField: root<R & O>().with(fields.foreign).str(),
          }),
          as: f<Rec<K, Arr<U>>>().of(k).str(),
          let: rawVars(vars, f<T>()),
          ...etc,
        },
      },
    ])
  }
