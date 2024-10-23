import type { App, HKT, I, IdHKT, RORec, StrKey } from '../../types'

export const map = <T, K extends string & keyof T, V extends RORec<K, unknown>>(
  x: Pick<T, K>,
  f: <P extends K>(v: T[P], k: P) => V[P],
): V => Object.fromEntries<V, 0>(Object.entries(x).map<[K, V[K]]>(([k, v]) => [k, f(v, k)]))

export type ExactPart<T, F extends HKT<T[StrKey<T>]>> = {
  readonly [K in StrKey<T>]: readonly [K, App<F, T[K]>]
}
export type ExactPart1<T, F extends HKT<readonly [T, StrKey<T>]>> = {
  readonly [K in StrKey<T>]: App<F, readonly [T, K]>
}
export type Exact<T, F extends HKT<T[StrKey<T>]>> = {
  readonly [K in string]: readonly [StrKey<T>, unknown]
} & ExactPart<T, F>

export type ExactKeys<K extends string> = { readonly [P in K]: P } & RORec<string, K>

export const asExact = <K extends string>(keyObject: ExactKeys<K>): Exact<RORec<K, 1>, IdHKT> =>
  Object.fromEntries<{ readonly [P in K]: readonly [P, 1] }>(
    Object.values(keyObject).map<[K, readonly [K, 1]]>(k => [k, [k, 1]]),
  )

export const mapExactToObject = <
  T,
  F extends HKT<T[StrKey<T>]>,
  G extends HKT<readonly [T, StrKey<T>]>,
>(
  x: Exact<T, F>,
  f: <P extends StrKey<T>>(v: App<F, T[P]>, k: P) => App<G, readonly [T, P]>,
): ExactPart1<T, G> => {
  type K = StrKey<T>
  const matched: readonly Entry<ExactPart<T, F>, K>[] = Object.entries(x).filter(
    (x): x is Entry<ExactPart<T, F>, K> => x[0] === x[1][0],
  )
  return Object.fromEntries<ExactPart1<T, G>, 0>(
    matched.map<K, ExactPart<T, F>, ExactPart1<T, G>, 2>(([k, v]) => [k, f(v[1], k)]),
  )
}

interface WithKey<T, G extends HKT<T[StrKey<T>]>> extends HKT<readonly [T, StrKey<T>]> {
  readonly out: readonly [
    I<readonly [T, StrKey<T>], this>[1],
    App<G, I<readonly [T, StrKey<T>], this>[0][I<readonly [T, StrKey<T>], this>[1]]>,
  ]
}

export const mapExact = <T, F extends HKT<T[StrKey<T>]>, G extends HKT<T[StrKey<T>]>>(
  x: Exact<T, F>,
  f: <P extends StrKey<T>>(v: App<F, T[P]>, k: P) => App<G, T[P]>,
): Exact<T, G> => mapExactToObject<T, F, WithKey<T, G>>(x, (v, k) => [k, f(v, k)])
