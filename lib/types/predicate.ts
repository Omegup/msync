import type { RawObj, Type } from '../../types'

declare const Predicate: unique symbol
declare const PredicateRaw: unique symbol
export type PredicateRaw = RawObj & {
  [Type]?(x: typeof PredicateRaw): void
}
export interface Predicate<in V> {
  [Type]?(x: typeof Predicate, _: V): void
  raw: PredicateRaw
}
