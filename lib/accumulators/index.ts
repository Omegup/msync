import type { J, RawObj } from '../../types'
import type { Accumulator, AccumulatorRaw, Expr } from '../types'

const asAccumulator = <T, V, C = unknown>(x: RawObj) => x as AccumulatorRaw<T, V, C>

export const $sum = <D extends J, C>(expr: Expr<number, D, C>): Accumulator<D, number, C> => ({
  raw: f => asAccumulator({ $sum: expr.raw(f).get() }),
})
