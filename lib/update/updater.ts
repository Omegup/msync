import type { Arr, HKT, I, N, O, StrKey, Type, notArr, rawItem } from '../../types'
import { Field } from '../field'
import type { Expr } from '../types'
import { mapExactToObject0, type MapO } from '../utils/map-object'

type Omit<T, K extends keyof any> = T extends T ? Pick<T, Exclude<keyof T, K>> : never;

declare const Updater: unique symbol
export type Updater<in R, in T, out V, in C = unknown> = {
  [Type]?(x: typeof Updater, r: R, t: T, c: C): V
  readonly raw: <D extends O>(f: Field<D, R | N>) => readonly (readonly [string, rawItem])[]
}

export const subUpdater = <P extends O, D, T, V, Ctx>(
  a: Updater<D, T, V, Ctx>,
  f: Field<P, D>,
): Updater<P, T, V, Ctx> => ({ raw: <R extends O>(g: Field<R, P | N>) => a.raw(g.with(f)) })

export interface UpdaterHKT<R, Old, V, C, K extends keyof Old = keyof Old, V2 extends V = V> extends HKT<StrKey<V>> {
  readonly out: Updater<R, Get<Old, I<StrKey<V>, this>, K>, V2[I<StrKey<V>, this>], C>
}

export type Get<T, P extends string, K extends keyof T = never> = P extends K
  ? T[P] // help typescript to make a decision
  : P extends keyof T
    ? T[P]
    : undefined

export const set =
  <V>() =>
  <R, Old extends notArr, C = unknown, K extends keyof Old = never>(
    fields: MapO<V, UpdaterHKT<R, Old, V, C, K>>,
  ): Updater<R, Old, O & Omit<Old, StrKey<V>> & V, C> & Updater<R, Arr<Old>, Arr<Omit<Old, StrKey<V>> & V>, C> => ({
    raw: f => {
      type U = UpdaterHKT<R, Old, V, C, K>
      return Object.entries(mapExactToObject0<V, U, U>(fields, v => v)).flatMap(([k, v]) =>
        v.raw(f).map(([l, v]) => [`.${k}${l}`, v]),
      )
    },
  })

export const weaken = <R, T, V, C = unknown>(
  updater: Updater<R, T, V, C>,
): Updater<R | null, T | N, V | null, C> => ({ raw: f => updater.raw(f) })

export const to = <R, V, C = unknown, T = unknown>(expr: Expr<V, R, C>): Updater<R, T, V, C> => ({
  raw: f => [['', expr.raw(f).get()]],
})
export const items = <R, T, V, C = unknown>(x: Updater<R, T, V, C>) =>
  x as {} as Updater<R, Arr<T>, Arr<V>, C>
