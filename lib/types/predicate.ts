import { Type, type json } from '../../types'

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
}
