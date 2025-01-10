import type { Arr, IdHKT, O } from '../../types'
import { root } from '../field'
import type { Accumulators, Expr, LookupArgs, Query } from '../types'
import type { Updater } from '../update'
import {
  $documents1,
  $group1,
  $match1,
  $project1,
  $replaceWith1,
  $set1,
  $simpleLookup1,
  $unwind1,
} from './raws'
export * from './raws'

type s = string

export const $match_ = <Q, T extends Q & O, C = unknown>(query?: Query<T, C>) =>
  $match1(query)<IdHKT<O>>(root)

export const $set_ = <Q, T extends Q & O, V extends Q & O, C = unknown>(
  updater: Updater<T, T, V, C>,
) => $set1<Q, T, V, C>(updater)<IdHKT<O>>(root)

export const $replaceWith_ = <T extends O, V extends O, C = unknown>(expr: Expr<V, T, C>) =>
  $replaceWith1(expr)<IdHKT<O>>(root)

export const $unwind_ = <T extends O, K extends s, U>(k: K) => $unwind1<T, K, U>(k)<IdHKT<O>>(root)

export const $group_ =
  <V extends O>() =>
  <ID, T extends O, C = unknown>(id: Expr<ID, T, C>, args: Accumulators<T, V, C>) =>
    $group1<T, ID, V, C>(id, args)<IdHKT<O>>(root)

export const $documents_ = <T extends O, C>(docs: Expr<Arr<T>, unknown, C>) =>
  $documents1(docs)<IdHKT<O>>(root)

export const $project_ = $project1

export const $simpleLookup_ = <T extends O, U extends O, R, K extends s, Ctx, C = unknown, S = string>(
  args: LookupArgs<T, U, R, K, Ctx, C, S>,
) => $simpleLookup1(args)<IdHKT<O>>(root)
