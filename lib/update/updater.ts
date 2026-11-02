import type { Arr, Exclude, HKT, I, IdHKT, N, O, StrKey, Type, notArr } from '../../types'
import { eqTyped, ite, nil, sub } from '../expression'
import { Field, root } from '../field'
import type { Expr } from '../types'
import { mapExactToObject0, type MapO } from '../utils/map-object'

type Omit<T, K extends keyof any> = T extends T ? Pick<T, Exclude<keyof T, K>> : never

declare const Updater: unique symbol

type UpdaterExpr<in D, in C> = <R>(c: <V>(e: readonly [string, Expr<V, D, C>]) => R) => R
export type Updater<in R, in T, out V, in C = unknown> = {
  [Type]?(x: typeof Updater, r: R, t: T, c: C): V
  readonly raw: readonly UpdaterExpr<R, C>[]
}

export const subUpdater = <P extends O, D, T, V, Ctx>(
  a: Updater<D, T, V, Ctx>,
  f: Field<P, D>,
): Updater<P, T, V, Ctx> => ({
  raw: a.raw.map(g => c => c(g(([p, g]) => [p, sub(g, f)]))),
})

export interface UpdaterHKT<R, Old, V, C, K extends keyof Old = keyof Old, V2 extends V = V>
  extends UpdaterQHKT<R, Old, V2, StrKey<V>, C, K> {}

export interface UpdaterQHKT<R, Old, V, KV extends StrKey<V>, C, K extends keyof Old = keyof Old>
  extends HKT<KV> {
  readonly out: Updater<R, Get<Old, I<KV, this>, K>, V[I<KV, this>], C>
}

export type Get<T, P extends string, K extends keyof T = never> = P extends K
  ? T[P] // help typescript to make a decision
  : P extends keyof T
    ? T[P]
    : undefined

const rawSet = <R, Old extends notArr, C, V, K extends keyof Old, KV extends StrKey<V>>(
  fields: MapO<V, UpdaterQHKT<R, Old, V, KV, C, K>, KV>,
): readonly UpdaterExpr<R, C>[] => {
  type U = UpdaterQHKT<R, Old, V, KV, C, K>
  return Object.entries(mapExactToObject0<V, U, U, KV>(fields, v => v)).flatMap(([k, v]) =>
    v.raw.map(v => c => v(([l, v]) => c([`.${k}${l}`, v]))),
  )
}

export const set =
  <V>() =>
  <R, Old extends notArr, C = unknown, K extends keyof Old = never>(
    fields: MapO<V, UpdaterHKT<R, Old, V, C, K>>,
  ): Updater<R, Old, O & Omit<Old, StrKey<V>> & V, C> &
    Updater<R, Arr<Old>, Arr<Omit<Old, StrKey<V>> & V>, C> => ({
    raw: rawSet(fields),
  })

export const setQ = <VV, Q extends O>() => {
  type V = Omit<VV, StrKey<Q>>
  type KV = Exclude<StrKey<VV>, StrKey<Q>>
  return <R extends Q, C = unknown, K extends keyof R = never>(
    fields: MapO<V, UpdaterQHKT<R, R, VV, KV, C, K>, KV>,
  ): Updater<R, R, Q & Omit<R, StrKey<VV>> & V, C> => ({
    raw: rawSet<R, R, C, VV, K, KV>(fields),
  })
}

export const mapUpdater = <R, T, V, W, Ctx = unknown>(
  updater: Updater<R, T, V, Ctx>,
  map: <V, D>(e: Expr<V, D, Ctx>) => Expr<V, D, Ctx>,
): Updater<R, T, W, Ctx> => {
  return {
    raw: updater.raw.map(v => c => c(v(([p, v]) => [p, map(v)]))),
  }
}

export const weaken = <R extends O, T, V, C = unknown>(
  updater: Updater<R, T, V, C>,
): Updater<R | null, T | N, V | null, C> => ({
  raw: updater.raw.map(
    v => c =>
      v(<V>([p, v]: readonly [string, Expr<V, R, C>]) =>
        c([
          p,
          ite<V | N, null, R, IdHKT, C>(
            eqTyped<null, R, IdHKT, C>(root<R | null>().expr(), nil),
            root<null>().expr(),
            v,
          ),
        ]),
      ),
  ),
})

export const to = <R, V, Ctx = unknown, T = unknown>(
  expr: Expr<V, R, Ctx>,
): Updater<R, T, V, Ctx> => ({
  raw: [c => c(['', expr])],
})
export const items = <R, T, V, C = unknown>(x: Updater<R, T, V, C>) =>
  x as {} as Updater<R, Arr<T>, Arr<V>, C>
