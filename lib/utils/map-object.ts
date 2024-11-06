import type { App, HKT, I, IdHKT, RORec, StrKey } from '../../types'
import { id } from './json'

export const map = <T, K extends string & keyof T, V extends RORec<K, unknown>>(
  x: Pick<T, K>,
  f: <P extends K>(v: T[P], k: P) => V[P],
): V => Object.fromEntries<V, 0>(Object.entries(x).map<[K, V[K]]>(([k, v]) => [k, f(v, k)]))

export type ExactPart<T, F extends HKT<T[StrKey<T>]>> = MapKPart<StrKey<T>, MappedHKT<T, F>>

export type ExactPart1<T, F extends HKT<StrKey<T>>> = {
  readonly [K in StrKey<T>]: App<F, K>
}

type s = string
export type MapKDom<
  RK extends MapKDom<RK, F, Dom>,
  F extends HKT<Dom & keyof RK>,
  Dom extends string = string,
> = MapK<Dom & keyof RK, F, Dom> & {
  readonly [P in Dom]?: readonly [keyof RK, unknown]
}
export type ExactKeys<K extends string> = Exact<RORec<K, 1>, IdHKT>

export type MapK<K extends Dom, F extends HKT<K>, Dom extends s = s> = MapKPart<K, F> & {
  readonly [P: string]: readonly [K, unknown]
}

export type MapKPart<K extends string, F extends HKT<K>> = {
  readonly [P in K]: readonly [P, App<F, P>]
}
export type MapKPart1<K extends string, F extends HKT<K>> = {
  readonly [P in K]: App<F, P>
}

export type Exact<T, F extends HKT<T[StrKey<T>]>> = MapK<StrKey<T>, MappedHKT<T, F>>

export interface MappedHKT<T, F extends HKT<T[StrKey<T>]>> extends HKT<StrKey<T>> {
  readonly out: App<F, T[I<StrKey<T>, this>]>
}

export const mapExactToObject1 = <K extends string, F extends HKT<K>, G extends HKT<K>>(
  x: MapK<K, F>,
  f: <P extends K>(v: App<F, P>, k: P) => App<G, P>,
): MapKPart1<K, G> => {
  const filter = <T extends RORec<string, { 0: unknown }>, V extends T>(x: readonly Entry<T>[]) =>
    x.filter((x): x is Entry<V> => x[0] === x[1][0])
  const matched = filter<MapK<K, F>, MapKPart<K, F>>(Object.entries(x))
  return Object.fromEntries<MapKPart1<K, G>, 0>(
    matched.map<K, MapKPart<K, F>, MapKPart1<K, G>, 2>(([k, v]) => [k, f(v[1], k)]),
  )
}

export interface WithKey1<K extends string, G extends HKT<K>> extends HKT<K> {
  readonly out: readonly [I<K, this>, App<G, I<K, this>>]
}

export const mapExact1 = <K extends s, F extends HKT<K>, G extends HKT<K>>(
  x: MapK<K, F>,
  f: <P extends K>(v: App<F, P>, k: P) => App<G, P>,
): MapK<K, G> => mapExactToObject1<K, F, WithKey1<K, G>>(x, (v, k) => [k, f(v, k)])

export const mapExactToObject = <T, F extends HKT<T[StrKey<T>]>, G extends HKT<StrKey<T>>>(
  x: Exact<T, F>,
  f: <P extends StrKey<T>>(v: App<F, T[P]>, k: P) => App<G, P>,
): ExactPart1<T, G> => mapExactToObject1(x, f)

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
