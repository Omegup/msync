import type { Arr, IdHKT, J, RORec, StrKey, jsonItem } from '../../types'
import { root } from '../field'
import type { Accumulators, Expr, LookupArgs, Query, RawStages } from '../types'
import type { Updater } from '../update'
import { $documents1, $group1, $match1, $project1, $replaceWith1, $set1, $unwind1 } from './raws'
import { $simpleLookup1 } from './raws'
export * from './raws'

type s = string
type j = jsonItem

export const $match_ = <T extends J, C = unknown>(query?: Query<T, C>) =>
  $match1(query)<IdHKT<J>>(root)

export const $set_ = <T extends J, V extends J, C = unknown>(updater: Updater<T, T, V, C>) =>
  $set1(updater)<IdHKT<J>>(root)

export const $replaceWith_ = <T extends J, V extends J, C = unknown>(expr: Expr<V, T, C>) =>
  $replaceWith1(expr)<IdHKT<J>>(root)

export const $unwind_ = <T extends J, K extends s, U>(k: K) => $unwind1<T, K, U>(k)<IdHKT<J>>(root)

export const $group_ = <T extends J, ID extends J, K extends s, V extends RORec<K, j>, C>(
  id: Expr<ID, T, C>,
  args: Accumulators<T, K, V, C>,
) => $group1(id, args)<IdHKT<J>>(root)

export const $documents_ = <T extends J, C>(docs: Expr<Arr<T>, null, C>) =>
  $documents1(docs)<IdHKT<J>>(root)

export const $project_ = <T extends J>(projection: Record<StrKey<T>, 1>): RawStages<T, T> =>
  $project1<T>(projection)<IdHKT<J>>(root)

export const $simpleLookup_ = <T extends J, U extends J, R, K extends s, Ctx, C = unknown>(
  args: LookupArgs<T, U, R, K, Ctx, C>,
) => $simpleLookup1(args)<IdHKT<J>>(root)
