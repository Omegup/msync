import type { J, RORec, RawObj, Type, U, Undef, jsonItem } from '../../types'
import { Field } from '../field'

declare const AccumulatorRaw: unique symbol
declare const Accumulator: unique symbol

export interface AccumulatorRaw<in Doc, out T, in C = unknown> extends RawObj {
  [Type](_: typeof AccumulatorRaw, source: Doc, ctx: C): readonly [typeof AccumulatorRaw, T]
}

export type Accumulators<in T, out V extends RORec<string, jsonItem>, in C = unknown> = {
  readonly [P in keyof V]: Accumulator<T, V[P], C>
}

export type AccumulatorsRoot<Acc extends Accumulators<never, RORec<string, jsonItem>, never>> =
  Acc extends Accumulators<infer T extends J, RORec<string, jsonItem>, never> ? T : never

export type Accumulator<in Doc, out T, in Ctx = unknown> = {
  [Type]?(_: typeof Accumulator): typeof Accumulator
  raw: {
    <DeltaD extends J, I extends U, C = unknown>(
      f: Field<DeltaD, Doc | Undef<I>, C>,
    ): AccumulatorRaw<T | I, DeltaD, Ctx & C>
  }
}

export type AccumulatorsParam<
  T extends J,
  Acc extends Accumulators<T, RORec<string, jsonItem>, C>,
  C = unknown,
> = {
  readonly [P in keyof Acc]: Acc[P] extends Accumulator<T, infer V extends jsonItem, C>
    ? V
    : jsonItem
}
