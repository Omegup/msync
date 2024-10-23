import type { App, ConstHKT, HKT, I, jsonItem, Par, Rec, RORec } from '../../types'

const unsafeEqual = <T, V>() => ({
  forward: (x: T) => x as {} as V,
  backward: (x: V) => x as {} as T,
})
interface PHKT<s, DF extends HKT<s>> extends HKT<s> {
  readonly out: HKT<App<DF, I<s, this>>>
}

const unsafeOmit = <s extends keyof any, DF extends HKT<s>, RecF extends PHKT<s, DF>>() => {
  type FDom<K extends s, T extends App<DF, K>> = HKT<App<App<RecF, K>, T>>
  return <
    K extends s,
    E extends s,
    R extends s,
    T extends App<DF, Exclude<K, E | R>>,
    F extends FDom<K, T>,
  >() =>
    unsafeEqual<
      App<F, App<App<RecF, Exclude<K, E | R>>, T>>,
      App<F, Omit<App<App<RecF, Exclude<K, E | R>>, T>, R>>
    >()
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
