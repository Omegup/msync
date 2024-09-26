import type { Arr, IdHKT, J, RORec, StrKey, jsonItem } from '../../types'
import { root } from '../field'
import type { Accumulators, Expr, LookupArgs, Query } from '../types'
import type { Updater } from '../update'
import { $documents1, $group1, $match1, $project1, $replaceWith1, $set1, $simpleLookup1, $unwind1 } from './raws'
export * from './raws'

type s = string
type j = jsonItem

export const $match_ = <Q, T extends Q & J, C = unknown>(query?: Query<T, C>) =>
  $match1(query)<IdHKT<J>>(root)

export const $set_ = <Q, T extends Q & J, V extends Q & J, C = unknown>(updater: Updater<T, T, V, C>) =>
  $set1<Q, T, V, C>(updater)<IdHKT<J>>(root)

export const $replaceWith_ = <T extends J, V extends J, C = unknown>(expr: Expr<V, T, C>) =>
  $replaceWith1(expr)<IdHKT<J>>(root)

export const $unwind_ = <T extends J, K extends s, U>(k: K) => $unwind1<T, K, U>(k)<IdHKT<J>>(root)

export const $group_ = <
  T extends J,
  ID extends j,
  K extends s,
  Acc extends Accumulators<T, K, RORec<K, j>, C>,
  C,
>(
  id: Expr<ID, T, C>,
  args: Acc,
) => $group1(id, args)<IdHKT<J>>(root)

export const $documents_ = <T extends J, C>(docs: Expr<Arr<T>, null, C>) =>
  $documents1(docs)<IdHKT<J>>(root)

export const $project_ = <T extends J>(projection: Record<StrKey<T>, 1>) =>
  $project1<T>(projection)<IdHKT<J>>(root)

export const $simpleLookup_ = <T extends J, U extends J, R, K extends s, Ctx, C = unknown>(
  args: LookupArgs<T, U, R, K, Ctx, C>,
) => $simpleLookup1(args)<IdHKT<J>>(root)
