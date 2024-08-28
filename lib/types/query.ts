import type { Expr } from '.'
import type { JsonObj, RawObj, Type } from '../../types'
import type { Field } from '../field'

declare const Query: unique symbol
declare const QueryRaw: unique symbol

export type QueryRaw = RawObj & {
  [Type]?(x: typeof QueryRaw): void
}

export type Query<in T extends JsonObj> = {
  [Type]?(x: typeof Query, y: T): void
  raw: (prefix: (k: string) => string) => QueryRaw
  expr: <DeltaT extends JsonObj>(f: Field<DeltaT, T>)=>Expr<boolean, DeltaT, unknown>
}
