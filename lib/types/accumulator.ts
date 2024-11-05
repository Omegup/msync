import type {
  ConstHKT,
  HKT,
  I,
  O,
  RORec,
  RawObj,
  StrKey,
  Type,
  U,
  Undef,
  jsonItem,
} from '../../types'
import type { Field } from '../field'
import type { Exact, MapKDom } from '../utils/map-object'
import type { Expr } from './expr'

declare const AccumulatorRaw: unique symbol
declare const Accumulator: unique symbol

export interface AccumulatorRaw<in Doc, out T, in C = unknown> extends RawObj {
  [Type](_: typeof AccumulatorRaw, source: Doc, ctx: C): readonly [typeof AccumulatorRaw, T]
}

export interface AccumulatorHKT<T, C = unknown> extends HKT<unknown> {
  readonly out: Accumulator<T, I<unknown, this>, C>
}

export type Accumulators<T, V extends RORec<string, jsonItem>, C = unknown> = Exact<
  V,
  AccumulatorHKT<T, C>
>
export interface DeltaAccumulatorHKT<T, C = unknown> extends HKT<unknown> {
  readonly out: DeltaAccumulator<T, I<unknown, this>, C>
}

export type DeltaAccumulators<T, V extends RORec<string, jsonItem>, C = unknown> = Exact<
  V,
  DeltaAccumulatorHKT<T, C>
>

export type AccumulatorsRoot<Acc extends Accumulators<never, RORec<string, jsonItem>, never>> =
  Acc extends Accumulators<infer T extends O, RORec<string, jsonItem>, never> ? T : never

export type Accumulator<in Doc, out T, in Ctx = unknown> = {
  [Type]?(_: typeof Accumulator): typeof Accumulator
  raw: {
    <DeltaD extends O, I extends U, C = unknown>(
      f: Field<DeltaD, Doc | Undef<I>, C>,
    ): AccumulatorRaw<T | I, DeltaD, Ctx & C>
  }
}

export type DeltaAccumulator<in out Doc, in out T, in out Ctx = unknown> = {
  raw: {
    <DeltaD extends O, I extends U, C = unknown>(
      f: Field<DeltaD, Doc | Undef<I>, C>,
    ): AccumulatorRaw<T | I, DeltaD, Ctx & C>
  }
  zero: Expr<T, unknown, Ctx>
  sum: <D, C = Ctx>(a: Expr<T, D, C>, b: Expr<T, D, C>) => Expr<T, D, C>
  diff: <D, C = Ctx>(a: Expr<T, D, C>, b: Expr<T, D, C>) => Expr<T, D, C>
}

export type ConstAccumulatorHKT<T, C> = ConstHKT<Accumulator<T, unknown, C>>
export type ConstDeltaAccumulatorHKT<T, C> = ConstHKT<DeltaAccumulator<T, unknown, C>>
export type AccumulatorArgs<T, A extends MapKDom<A, ConstAccumulatorHKT<T, C>>, C = unknown> = {
  readonly [K in StrKey<A>]: A[K] extends Accumulator<T, infer V, C> ? V : never
}
