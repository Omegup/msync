import type { Expr } from './expr'
import type { J, RORec, RawObj, Type, U, Undef, jsonItem } from '../../types'
import type { Field } from '../field'
import type { Delta } from '.'

declare const AccumulatorRaw: unique symbol
declare const Accumulator: unique symbol

export interface AccumulatorRaw<in Doc, out T, in C = unknown> extends RawObj {
  [Type](_: typeof AccumulatorRaw, source: Doc, ctx: C): readonly [typeof AccumulatorRaw, T]
}

export type Accumulators<in T, out V extends RORec<string, jsonItem>, in C = unknown> = {
  readonly [P in keyof V]: Accumulator<T, V[P], C>
}
export type DeltaAccumulators<
  in out T,
  in out V extends RORec<string, jsonItem>,
  in out C = unknown,
> = {
  readonly [P in keyof V]: DeltaAccumulator<T, V[P], C>
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


export type DeltaAccumulator<in out Doc, in out T, in out Ctx = unknown> = {
  raw: {
    <DeltaD extends J, I extends U, C = unknown>(
      f: Field<DeltaD, Doc | Undef<I>, C>,
    ): AccumulatorRaw<T | I, DeltaD, Ctx & C>
  }
  diff: Expr<T, Delta<T>, Ctx>
}
