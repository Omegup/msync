import type { Expr } from '.'
import type { JsonObj, RawObj, Type } from '../../types'
import type { Field } from '../field'

declare const Query: unique symbol
declare const QueryRaw: unique symbol

export type QueryRaw<T, C> = RawObj & {
  [Type]?(x: typeof QueryRaw, y: T, c: C): void
}

export type Query<in T extends JsonObj, in C = unknown> = {
  [Type]?(x: typeof Query, y: T, c: C): void
  raw: (prefix: (k: string) => string) => QueryRaw<T, C>
  expr: <DeltaT extends JsonObj>(f: Field<DeltaT, T>)=>Expr<boolean, DeltaT, C>
}
