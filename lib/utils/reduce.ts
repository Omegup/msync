import type { App, AppMap, HKT, IdHKT } from '../../types'

export type Chain<
  T extends readonly unknown[],
  H extends HKT<Dom>,
  Dom = unknown,
> = T extends readonly [infer S, infer N, ...infer V]
  ? [(x: App<H, S & Dom>) => App<H, N & Dom> & Dom, ...Chain<readonly [N, ...V], H, Dom>]
  : []
export type ChainID<T extends readonly Dom[], Dom = unknown> = Chain<T, IdHKT<Dom>, Dom>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Last<T extends readonly unknown[]> = T extends [...infer _, infer A] ? A : unknown

export type All<T extends readonly unknown[]> = T extends [infer A, ...infer Rest] ? A & All<Rest> : unknown

export function reduce<
  Dom,
  Arr extends readonly Dom[],
  H extends HKT<Dom>,
  F extends HKT<(x: never) => Dom>,
>(
  fs: AppMap<F, Chain<Arr, H, Dom>, (x: never) => Dom>,
  f: <I extends `${number}` & keyof Chain<Arr, H, Dom>>(
    x: App<F, Chain<Arr, H, Dom>[I]>,
  ) => Chain<Arr, H, Dom>[I] | undefined,
  init: App<H, Arr[0]>,
): App<H, Last<Arr> & Dom>
export function reduce<Dom, F extends HKT<(x: Dom) => Dom>>(
  fs: readonly App<F, (x: Dom) => Dom>[],
  f: (x: App<F, (x: Dom) => Dom>) => ((x?: Dom) => Dom) | undefined,
  init: Dom | undefined,
): Dom | undefined {
  return fs.reduce((acc, x) => f(x)?.(acc), init)
}
