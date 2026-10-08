import type { App, AsLiteral, HKT, IdHKT, N } from '../../types'

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
export const reflex = <Dom, T extends Dom>(): Equal<Dom, T, T> => ({
  backward: id,
  forward: id,
  backward1: id,
  forward1: id,
})
const id = <T>(x: T) => x
const assertEqual = <Dom, T extends Dom, V extends Dom>() => reflex() as Equal<Dom, T, V>

export const fromEq = <Dom, T extends Dom, V extends Dom>(
  eq: Pick<Equal<Dom, T, V>, 'forward' | 'backward'>,
): Equal<Dom, T, V> => ({
  ...eq,
  backward1: eq.backward<IdHKT<Dom>>,
  forward1: eq.forward<IdHKT<Dom>>,
})
export const literalsEqaul = <T extends keyof any | boolean | N, V extends T>(
  _: AsLiteral<T> & V,
) => assertEqual<T, T, V>()
