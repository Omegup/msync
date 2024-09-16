import type { J, RORec, RawObj, Type, U, Undef, jsonItem } from '../../types'
import { Field } from '../field'

declare const AccumulatorRaw: unique symbol
declare const Accumulator: unique symbol

export interface AccumulatorRaw<in Doc, out T, in C = unknown> extends RawObj {
  [Type]?(_: typeof AccumulatorRaw, source: Doc, ctx: C): readonly [typeof AccumulatorRaw, T]
}

export type Accumulators<T, K extends string, V extends RORec<K, jsonItem>, C> = {
  readonly [P in K]: Accumulator<T, V[P], C>
}

export type Accumulator<in Doc, out T, in Ctx = unknown> = {
  [Type](_: typeof Accumulator): typeof Accumulator
  raw: {
    <DeltaD extends J, I extends U, C = unknown>(
      f: Field<DeltaD, Doc | Undef<I>, C>,
    ): AccumulatorRaw<T | I, DeltaD, Ctx & C>
  }
}
