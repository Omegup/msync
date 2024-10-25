import type { App, ConstHKT, HKT, I, jsonItem, Par, Rec, RORec } from '../../types'

export type Equal<Dom, T extends Dom, V extends Dom> = {
  forward: <F extends HKT<Dom>>(x: App<F, T>) => App<F, V>
  backward: <F extends HKT<Dom>>(x: App<F, V>) => App<F, T>
}
export const sym = <Dom, T extends Dom, V extends Dom>(eq: Equal<Dom, T, V>): Equal<Dom, V, T> => eq
const id = <T>(x: T) => x
const assertEqual = <Dom, T extends Dom, V extends Dom>() =>
  ({
    forward: id,
    backward: id,
  }) as Equal<Dom, T, V>
interface PHKT<s, DF extends HKT<s>> extends HKT<s> {
  readonly out: HKT<App<DF, I<s, this>>>
}

const unsafeOmit = <s extends keyof any, DF extends HKT<s>, RecF extends PHKT<s, DF>>() => {
  type FDom<K extends s, T extends App<DF, K>> = App<App<RecF, K>, T>
  return <K extends s, E extends s, R extends s, T extends App<DF, Exclude<K, E | R>>>(): Equal<
    FDom<K, T>,
    App<App<RecF, Exclude<K, E | R>>, T>,
    Omit<App<App<RecF, Exclude<K, E | R>>, T>, R>
  > => assertEqual()
}

interface RORec1HKT<K extends string> extends HKT<unknown> {
  readonly out: RORec<K, I<unknown, this>>
}
interface RORecHKT extends HKT<string> {
  readonly out: RORec1HKT<I<string, this>>
}

interface Par1HKT<K extends string> extends HKT<Rec<K, jsonItem>> {
  readonly out: Par<K, I<Rec<K, jsonItem>, this>>
}
interface ParHKT extends PHKT<string, ParDF> {
  readonly out: Par1HKT<I<string, this>>
}

interface ParDF extends HKT<string> {
  readonly out: Rec<I<string, this>, jsonItem>
}

export const omitRORec = unsafeOmit<string, ConstHKT<unknown>, RORecHKT>()
export const omitPar = unsafeOmit<string, ParDF, ParHKT>()

type s = keyof any

interface PickDF extends HKT<s> {
  readonly out: RORec<I<s, this>, jsonItem>
}
interface Pick1HKT<K extends s> extends HKT<RORec<K, jsonItem>> {
  readonly out: Pick<I<RORec<K, jsonItem>, this>, K>
}
interface PickHKT extends PHKT<s, PickDF> {
  readonly out: Pick1HKT<I<s, this>>
}
export const omitPick = unsafeOmit<s, PickDF, PickHKT>()

export const eqPar = <K extends string, T extends Rec<K, jsonItem>, K2 extends K>() =>
  assertEqual<unknown, Par<K2, T>, Par<K, T>>()
