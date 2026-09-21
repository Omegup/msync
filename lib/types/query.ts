import type { O, RawObj, Type } from '../../types'
import type { Field } from '../field'

declare const Query: unique symbol
declare const QueryRaw: unique symbol

export type QueryRaw<T, C = unknown> = RawObj & {
  [Type]?(x: typeof QueryRaw, y: T, c: C): void
}

export type Query<in T extends O, in C = unknown> = {
  [Type]?(x: typeof Query, y: T, c: C): void
  raw: <DeltaT extends O>(f: Field<DeltaT, T>) => QueryRaw<DeltaT, C>
}
