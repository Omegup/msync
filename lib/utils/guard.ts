import type { App, AsLiteral, HKT, jsonItem, N, Par, Rec, RORec } from '../../types'

export type Equal<Dom, T extends Dom, V extends Dom> = {
  forward: <F extends HKT<Dom>>(x: App<F, T>) => App<F, V>
  forward1: (x: T) => V
  backward: <F extends HKT<Dom>>(x: App<F, V>) => App<F, T>
  backward1: (x: V) => T
}
export const sym = <Dom, T extends Dom, V extends Dom>(eq: Equal<Dom, T, V>): Equal<Dom, V, T> => ({
  backward: eq.forward,
  forward: eq.backward,
  backward1: eq.forward1,
  forward1: eq.backward1,
})
const id = <T>(x: T) => x
const assertEqual = <Dom, T extends Dom, V extends Dom>() =>
  ({
    forward: id,
    backward: id,
    forward1: id,
    backward1: id,
  }) as Equal<Dom, T, V>

export const literalsEqaul = <T extends keyof any | boolean | N, V extends T>(_: AsLiteral<T> & V) => assertEqual<T, T, V>()

export const omitRORec = <
  K extends string,
  E extends string,
  R extends string,
  T extends unknown,
>() => assertEqual<unknown, RORec<Exclude<K, E | R>, T>, Omit<RORec<Exclude<K, E | R>, T>, R>>()

type s = keyof any

export const omitPick = <
  K extends s,
  E extends s,
  R extends s,
  T extends RORec<Exclude<K, E | R>, unknown>,
>() => assertEqual<unknown, Pick<T, Exclude<K, E | R>>, Omit<Pick<T, Exclude<K, E | R>>, R>>()

export const omitExclude = <
  K extends s,
  E extends s,
  R extends s,
  T extends RORec<Exclude<K, E | R>, unknown>,
>() => assertEqual<unknown, Omit<T, E & Exclude<K, keyof T>>, Omit<Pick<T, Exclude<K, E | R>>, R>>()
export const renamedFields = <K extends s, F extends HKT<K, s>, G extends HKT<App<F, K>>>() =>
  assertEqual<s, keyof { [P in K as App<F, P>]: App<G, P> }, App<F, K>>()

export const translateOmit = <
  T,
  K extends string,
  Q extends string,
  P extends string,
>() => assertEqual<unknown, Omit<Omit<T, K | Q>, P>, Omit<Omit<T, K | Q>, P | Q>>()

export const excludeIdem = <
  K extends s,
  E extends s,
  S extends E = E,
>() => assertEqual<Exclude<K, E>, Exclude<K, E>, Exclude<Exclude<K, E>, S>>()

export const eqPar = <K extends string, T extends Rec<K, jsonItem>, K2 extends K>() =>
  assertEqual<unknown, Par<K2, T>, Par<K, T>>()

export const notExtendExcluded = <
  Key extends keyof any,
  Others extends keyof any,
  Source extends keyof any,
  Denied extends keyof any,
  F extends HKT<Others | Exclude<Source, Denied | Key>, Dom>,
  Else extends Dom,
  Dom = unknown,
>() =>
  assertEqual<
    Dom,
    Key extends Others | Exclude<Source, Denied | Key> ? App<F, Key> : Else,
    Key extends Others ? App<F, Key> : Else
  >()
