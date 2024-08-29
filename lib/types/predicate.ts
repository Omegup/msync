import type { Expr } from '.'
import type { Type, RawObj, JsonObj } from '../../types'
import type { Field } from '../field'

declare const Predicate: unique symbol
declare const PredicateRaw: unique symbol
export type PredicateRaw = RawObj & {
  [Type]?(x: typeof PredicateRaw): void
}
export interface Predicate<in D> {
  [Type]?(x: typeof Predicate, _: D): void
  raw: PredicateRaw
  expr: <T extends JsonObj>(field: Field<T, D>) => Expr<boolean, T, unknown>
}
