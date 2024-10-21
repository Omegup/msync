import type { Arr, J, RawObj, U, Undef } from '../../types'
import { subtract } from '../expression/arith'
import { $ifNull } from '../expression/logic'
import { val } from '../expression/val'
import { root, type Field } from '../field'
import type { Delta, Accumulator, AccumulatorRaw, DeltaAccumulator, Expr } from '../types'

const asAccumulator = <T, V, C = unknown>(x: RawObj) => x as AccumulatorRaw<T, V, C>

export const $sumDelta = <D extends J, C>(expr: Expr<number, D, C>): DeltaAccumulator<D, number, C> => ({
  raw: f => asAccumulator({ $sum: expr.raw(f).get() }),
  diff: subtract(
    $ifNull(root<Delta<number>>().of('after').expr(), val(0)),
    $ifNull(root<Delta<number>>().of('before').expr(), val(0)),
  ),
})
export const $sum = <D extends J, C>(expr: Expr<number, D, C>): Accumulator<D, number, C> => $sumDelta(expr)

export const $push = <D extends J, T, C>(expr: Expr<T, D, C>): Accumulator<D, Arr<T>, C> => ({
  raw: f => asAccumulator({ $push: expr.raw(f).get() }),
})
export const subAcc = <T, D, P extends J, Ctx = unknown>(
  a: Accumulator<D, T, Ctx>,
  f: Field<P, D, Ctx>,
): Accumulator<P, T, Ctx> => ({
  raw: <DeltaD extends J, I extends U, C = unknown>(g: Field<DeltaD, P | Undef<I>, C>) =>
    a.raw(g.with<P, D, I, Ctx, 2>(f)),
})
