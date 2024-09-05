import type { Expr } from '.'
import type { Type, RawObj, JsonObj } from '../../types'
import type { Field } from '../field'

declare const Predicate: unique symbol
declare const PredicateRaw: unique symbol
export type PredicateRaw = RawObj & {
  [Type]?(x: typeof PredicateRaw): void
}
export interface Predicate<in V> {
  [Type]?(x: typeof Predicate, _: V): void
  raw: PredicateRaw
  expr: <D extends JsonObj, C>(field: Field<D, V, C>) => Expr<boolean, D, C>
}
