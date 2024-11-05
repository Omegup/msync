import type { Arr, HKT, I, N, O, StrKey, Type, notArr, rawItem } from '../../types'
import { Field, type Path } from '../field'
import type { Expr } from '../types'
import { mapExactToObject1, type MapK } from '../utils/map-object'

declare const Updater: unique symbol
export type Updater<in R, in T, out V, in C = unknown> = {
  [Type]?(x: typeof Updater, r: R, t: T, c: C): V
  readonly raw: <D extends O>(f: Field<D, R | N>) => readonly (readonly [string, rawItem])[]
}

export const subUpdater = <P extends O, D, T, V, Ctx>(
  a: Updater<D, T, V, Ctx>,
  f: Path<P, D | N>,
): Updater<P, T, V, Ctx> => ({ raw: <R extends O>(g: Field<R, P | N>) => a.raw(g.with(f)) })

export interface UpdaterHKT<R, Old, V, C, K extends keyof Old = keyof Old> extends HKT<StrKey<V>> {
  readonly out: Updater<R, Get<Old, I<StrKey<V>, this>, K>, V[I<StrKey<V>, this>], C>
}

export type Get<T, P extends string, K extends keyof T = never> = P extends K
  ? T[P] // help typescript to make a decision
  : P extends keyof T
    ? T[P]
    : undefined

export const set =
  <V>() =>
  <R, Old, C = unknown, K extends keyof Old = never>(
    fields: MapK<StrKey<V>, UpdaterHKT<R, Old, V, C, K>>,
  ): Updater<R, Old, Omit<Old, StrKey<V>> & V, C> => ({
    raw: f => {
      type U = UpdaterHKT<R, Old, V, C, K>
      return Object.entries(mapExactToObject1<StrKey<V>, U, U>(fields, v => v)).flatMap(([k, v]) =>
        v.raw(f).map(([l, v]) => [`.${k}${l}`, v]),
      )
    },
  })

export const weaken = <R, T, V, C = unknown>(
  updater: Updater<R, T, V, C>,
): Updater<R, T | null, V | null, C> => ({ raw: f => updater.raw(f) })

export const to = <R, V, C = unknown>(expr: Expr<V, R, C>): Updater<R, notArr, V, C> => ({
  raw: f => [['', expr.raw(f).get()]],
})
export const items = <R, T, V, C = unknown>(x: Updater<R, T, V, C>) =>
  x as {} as Updater<R, Arr<T>, Arr<V>, C>
