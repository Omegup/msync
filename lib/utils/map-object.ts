import type { App, HKT, I, IdHKT, RORec, StrKey } from '../../types'
import { id } from './json'

export const map = <T, K extends string & keyof T, V extends RORec<K, unknown>>(
  x: Pick<T, K>,
  f: <P extends K>(v: T[P], k: P) => V[P],
): V => Object.fromEntries<V, 0>(Object.entries(x).map<[K, V[K]]>(([k, v]) => [k, f(v, k)]))

export type ExactPart<T, F extends HKT<T[StrKey<T>]>> = MapOPart<T, MappedHKT<T, F>>

export type ExactPart1<T, F extends HKT<StrKey<T>>> = {
  readonly [K in StrKey<T>]: App<F, K>
}

type s = string
export type MapKDom<RK extends MapKDom<RK, F>, F extends HKT<StrKey<RK>>> = MapO<RK, F> & {
  readonly [P in s]?: readonly [keyof RK, unknown]
}
export type ExactKeys<K extends string> = Exact<RORec<K, 1>, IdHKT>

export type MapO<T, F extends HKT<K>, K extends StrKey<T> = StrKey<T>> = MapOPart<T, F, K> & {
  readonly [P: string]: readonly [K, unknown]
}

export type MapK<K extends s, F extends HKT<K>> = MapO<RORec<K>, F>

export type MapOPart<T, F extends HKT<K>, K extends keyof T = StrKey<T>> = {
  readonly [P in K]: readonly [P, App<F, P & string>]
}
export type MapKPart1<T, F extends HKT<K>, K extends StrKey<T> = StrKey<T>> = {
  readonly [P in K]: App<F, P>
}

export type Exact<T, F extends HKT<T[StrKey<T>]>> = MapO<T, MappedHKT<T, F>>

export interface MappedHKT<T, F extends HKT<T[StrKey<T>]>> extends HKT<StrKey<T>> {
  readonly out: App<F, T[I<StrKey<T>, this>]>
}

export const mapExactToObject0 = <T, F extends HKT<K>, G extends HKT<K>, K extends StrKey<T> = StrKey<T>>(
  x: MapO<T, F, K>,
  f: <P extends K>(v: App<F, P>, k: P) => App<G, P>,
): MapKPart1<T, G, K> => {
  const filter = <T extends RORec<string, { 0: unknown }>, V extends T>(x: readonly Entry<T>[]) =>
    x.filter((x): x is Entry<V> => x[0] === x[1][0])
  const matched = filter<MapO<T, F, K>, MapOPart<T, F, K>>(Object.entries(x))
  return Object.fromEntries<MapKPart1<T, G, K>, 0>(
    matched.map<K, MapOPart<T, F, K>, MapKPart1<T, G, K>, 2>(([k, v]) => [k, f(v[1], k)]),
  )
}

export const mapExactToObject1 = <K extends string, F extends HKT<K>, G extends HKT<K>>(
  x: MapK<K, F>,
  f: <P extends K>(v: App<F, P>, k: P) => App<G, P>,
): MapKPart1<RORec<K>, G> => mapExactToObject0<RORec<K>, F, G>(x, f)

export interface WithKey1<K extends string, G extends HKT<K>> extends HKT<K> {
  readonly out: readonly [I<K, this>, App<G, I<K, this>>]
}

export const mapExact0 = <T, F extends HKT<StrKey<T>>, G extends HKT<StrKey<T>>>(
  x: MapO<T, F>,
  f: <P extends StrKey<T>>(v: App<F, P>, k: P) => App<G, P>,
): MapO<T, G> => mapExactToObject0<T, F, WithKey1<StrKey<T>, G>>(x, (v, k) => [k, f(v, k)])

export const mapExact1 = <K extends s, F extends HKT<K>, G extends HKT<K>>(
  x: MapK<K, F>,
  f: <P extends K>(v: App<F, P>, k: P) => App<G, P>,
): MapK<K, G> => mapExactToObject1<K, F, WithKey1<K, G>>(x, (v, k) => [k, f(v, k)])

export const mapExactToObject = <T, F extends HKT<T[StrKey<T>]>, G extends HKT<StrKey<T>>>(
  x: Exact<T, F>,
  f: <P extends StrKey<T>>(v: App<F, T[P]>, k: P) => App<G, P>,
): ExactPart1<T, G> => mapExactToObject0<T, MappedHKT<T, F>, G>(x, f)

interface WithKey<T, G extends HKT<T[StrKey<T>]>> extends HKT<StrKey<T>> {
  readonly out: readonly [I<StrKey<T>, this>, App<G, T[I<StrKey<T>, this>]>]
}

export const mapExact = <T, F extends HKT<T[StrKey<T>]>, G extends HKT<T[StrKey<T>]>>(
  x: Exact<T, F>,
  f: <P extends StrKey<T>>(v: App<F, T[P]>, k: P) => App<G, T[P]>,
): Exact<T, G> => mapExactToObject<T, F, WithKey<T, G>>(x, (v, k) => [k, f(v, k)])

type Dom<T, V> = HKT<T[StrKey<T>] | V[StrKey<V>]>
export const spread = <T, V, F extends Dom<T, V>, E = unknown, No extends keyof V = never>(
  a: Exact<Omit<T, No>, F>,
  b: Exact<V, F>,
) => ({ ...a, ...mapExact(b, id) }) as Exact<V & Omit<T, keyof V> & Pick<E, symbol & keyof E>, F>

export interface MergeHKT<T, V, F1 extends HKT<StrKey<Omit<T, No>>>, F2 extends HKT<StrKey<V>>, No extends keyof V = never,>
  extends HKT<StrKey<V & Omit<T, No>>> {
  readonly out: I<StrKey<V & Omit<T, No>>, this> extends StrKey<V>
    ? App<F2, I<StrKey<V>, this>>
    : App<F1, I<StrKey<Omit<T, No>>, this>>
}

export const spread0 = <
  T,
  V,
  F1 extends HKT<StrKey<Omit<T, No>>>,
  F2 extends HKT<StrKey<V>>,
  E = unknown,
  No extends keyof V = never,
>(
  a: MapO<Omit<T, No>, F1>,
  b: MapO<V, F2>,
) =>
  ({ ...a, ...mapExact0(b, id) }) as MapO<
    V & Omit<T, No> & Pick<E, symbol & keyof E>,
    MergeHKT<T, V, F1, F2, No>
  >
