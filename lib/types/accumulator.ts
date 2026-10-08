import type { Expr } from './expr'
import type { HKT, I, N, O, RORec, RawObj, Rec, Type, U, Undef, jsonItem } from '../../types'
import type { Field } from '../field'
import type { Exact } from '../utils/map-object'

declare const AccumulatorRaw: unique symbol
declare const Accumulator: unique symbol

export interface AccumulatorRaw<in Doc, out T, in C = unknown> extends RawObj {
  [Type](_: typeof AccumulatorRaw, source: Doc, ctx: C): readonly [typeof AccumulatorRaw, T]
}

export interface AccumulatorHKT<T, C = unknown> extends HKT<unknown> {
  readonly out: Accumulator<T, I<unknown, this>, C>
}

export type Accumulators<T, V extends object, C = unknown> = Exact<
  V,
  AccumulatorHKT<T, C>
>
export interface DeltaAccumulatorHKT<T, C = unknown> extends HKT<unknown> {
  readonly out: DeltaAccumulator<T, I<unknown, this>, C>
}

export type DeltaAccumulators<T, V extends object, C = unknown> = Exact<
  V,
  DeltaAccumulatorHKT<T, C>
>

export type AccumulatorsRoot<Acc extends Accumulators<never, RORec<string, jsonItem>, never>> =
  Acc extends Accumulators<infer T extends O, RORec<string, jsonItem>, never> ? T : never

export type Accumulator<in Doc, out T, in Ctx = unknown> = {
  [Type]?(_: typeof Accumulator): typeof Accumulator
  raw: {
    <DeltaD extends O, I extends U>(
      f: Field<DeltaD, Doc | Undef<I>>,
    ): AccumulatorRaw<T | I, DeltaD, Ctx>
  }
}
export type Part<Doc> = Rec<'v', Doc> & RORec<'old', boolean> & { readonly deleted?: true | N }

export type DeltaAccumulator<in out Doc, in out T, in out Ctx = unknown> = {
  group: Accumulator<Part<Doc>, T, Ctx>
  merge: <D, C = Ctx>(a: Expr<T | N, D, C>, b: Expr<T, D, C>) => Expr<T, D, C>
}
