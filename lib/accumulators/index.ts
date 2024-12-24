import type { AppMap, Arr, ConstHKT, N, O, RawObj, rawItem } from '../../types'
import { add, subtract } from '../expression/arith'
import type { ExprHKT } from '../expression/concat'
import { $ifNull, ite, sub } from '../expression/logic'
import { func, val, type NoRaw } from '../expression/val'
import { root } from '../field'
import type { Accumulator, AccumulatorRaw, DeltaAccumulator, Expr, Part } from '../types'

const asAccumulator = <T, V, C = unknown>(x: RawObj) => x as AccumulatorRaw<T, V, C>

export const $sum_ = <D extends O, C = unknown>(
  expr: Expr<number, D, C>,
): Accumulator<D, number, C> => ({ raw: f => asAccumulator({ $sum: expr.raw(f).get() }) })
export const $sum = <D extends O, C = unknown>(
  expr: Expr<number, D, C>,
): DeltaAccumulator<D, number, C> => ({
  group: $sum_(
    ite(
      root<Part<D>>().of('old').expr(),
      subtract(val(0), sub(expr, root<Part<D>>().of('v'))),
      sub(expr, root<Part<D>>().of('v')),
    ),
  ),
  merge: (x, y) => add($ifNull(x, val(0)), $ifNull(y, val(0))),
})

export const $accumulator_ = <D, T, Ctx, A extends readonly unknown[]>(
  init: () => T,
  accumulateArgs: AppMap<ExprHKT<D, Ctx>, A>,
  accumulate: (a: T, ...args: A) => T,
  merge: (a: T, b: T) => NoRaw<T>,
): Accumulator<D, T, Ctx> => {
  return {
    raw: f =>
      asAccumulator({
        $accumulator: {
          init: init.toString(),
          initArgs: [],
          accumulate: accumulate.toString(),
          accumulateArgs: accumulateArgs.map<A, ExprHKT<D, Ctx>, ConstHKT<rawItem>, 1>(e =>
            e.raw(f).get(),
          ),
          merge: merge.toString(),
          lang: 'js',
        },
      }),
  }
}
export const $accumulator = <D, T, Ctx, A extends readonly unknown[]>(
  init: () => T,
  accumulateArgs: AppMap<ExprHKT<Part<D>, Ctx>, A>,
  accumulate: (a: T, ...args: A) => T,
  merge: (a: T | N, b: T) => NoRaw<T>,
): DeltaAccumulator<D, T, Ctx> => ({
  group: $accumulator_(init, accumulateArgs, accumulate, merge),
  merge: <D, C>(a: Expr<T | N, D, C>, b: Expr<T, D, C>): Expr<T, D, C> =>
    func<T, [T | N, T], D, C>(merge, a, b),
})

export const $push_ = <D extends O, T, C = unknown>(
  expr: Expr<T, D, C>,
): Accumulator<D, Arr<T>, C> => ({
  raw: f => asAccumulator({ $push: expr.raw(f).get() }),
})

export const $countDict = <D extends O, C = unknown>(
  expr: Expr<string, D, C>,
): DeltaAccumulator<D, Record<string, number>, C> =>
  $accumulator<D, Record<string, number>, C, [string, boolean]>(
    function () {
      return {}
    },
    [sub(expr, root<Part<D>>().of('v')), root<Part<D>>().of('old').expr()],
    function (a, k, old) {
      let y = (a[k] || 0) + (old ? -1 : 1)
      return y ? (a[k] = y) : delete a[k], a
    },
    function (a, b) {
      return Object.keys(b).reduce((a, k) => {
        let y = (a[k] || 0) + b[k]
        return y ? (a[k] = y) : delete a[k], a
      }, a || {})
    },
  )

export const $keys = <D extends O, C = unknown>(
  expr: Expr<Record<string, number>, D, C>,
): Expr<Arr<string>, D, C> =>
  func<Arr<string>, [Record<string, number>], D, C>(function (obj) {
    return Object.keys(obj)
  }, expr)
