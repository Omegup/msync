import type { Expr } from '.'
import { Type, type JsonObj, type json } from '../../types'
import type { Field } from '../field'

declare const Predicate: unique symbol
declare const PredicateRaw: unique symbol
export type PredicateRaw = json & {
  [Type]?(x: typeof PredicateRaw): void
}

export type DeepTest<in T> = <Root>(
  accessor: (testOnPart: (part: T) => boolean, spread: boolean) => (root: Root) => boolean,
) => (root: Root) => boolean

export interface Predicate<in D> {
  [Type]?(x: typeof Predicate, _: D): void
  raw: PredicateRaw
  expr: <T extends JsonObj>(mapper: ()=>Field<T, D>) => Expr<boolean, T, unknown>
}
