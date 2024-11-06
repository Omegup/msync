import type { App, HKT, jsonItem, Par, Rec, RORec } from '../../types'

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
