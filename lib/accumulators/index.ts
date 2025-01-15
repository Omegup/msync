import type { AppMap, Arr, ConstHKT, N, O, RawObj, Rec, rawItem } from '../../types'
import { add, subtract } from '../expression/arith'
import type { ExprHKT } from '../expression/concat'
import { $ifNull, ite, sub } from '../expression/logic'
import { func, val, type NoRaw, type RONoRaw } from '../expression/val'
import { root } from '../field'
import type { Accumulator, AccumulatorRaw, DeltaAccumulator, Expr, Part } from '../types'

const asAccumulator = <T, V, C = unknown>(x: RawObj) => x as AccumulatorRaw<T, V, C>

export const $sum_ = <D extends O, C = unknown>(
  expr: Expr<number | N, D, C>,
): Accumulator<D, number, C> => ({ raw: f => asAccumulator({ $sum: expr.raw(f).get() }) })
export const $sum = <D extends O, C = unknown>(
  expr: Expr<number | N, D, C>,
): DeltaAccumulator<D, number, C> => ({
  group: $sum_(
    ite(
      root<Part<D>>().of('old').expr(),
      subtract(val(0), $ifNull(sub(expr, root<Part<D>>().of('v')), val(0))),
      sub(expr, root<Part<D>>().of('v')),
    ),
  ),
  merge: (x, y) => add($ifNull(x, val(0)), y),
})

export const $accumulator_ = <D, T, Ctx, A extends readonly unknown[]>(
  init: () => RONoRaw<T>,
  accumulateArgs: AppMap<ExprHKT<D, Ctx>, A>,
  accumulate: (a: NoRaw<T>, ...args: NoRaw<A>) => RONoRaw<T>,
  merge: (...args: NoRaw<[T, T]>) => RONoRaw<T>,
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
  init: () => NoRaw<T>,
  accumulateArgs: AppMap<ExprHKT<Part<D>, Ctx>, A>,
  accumulate: (a: NoRaw<T>, ...args: NoRaw<A>) => NoRaw<T>,
  merge: (...args: NoRaw<[T | N, T]>) => NoRaw<T>,
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
): DeltaAccumulator<D, Rec<string, number>, C> =>
  $accumulator<D, Rec<string, number>, C, [string, boolean]>(
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
export const $pushDict = <D extends O, V, C = unknown>(
  key: Expr<string, D, C>,
  value: Expr<V, D, C>,
) =>
  // '1' => 'old'
  $accumulator<D, Rec<string, Rec<'1' | '0', Arr<V>>>, C, [string, V, boolean]>(
    function () {
      return {}
    },
    [
      sub(key, root<Part<D>>().of('v')),
      sub(value, root<Part<D>>().of('v')),
      root<Part<D>>().of('old').expr(),
    ],
    function (ra, k, v, old) {
      let a = { ...ra }
      //@ts-ignore
      const equal = (a, b) => {
        if ([a, b].some(a => !a || typeof a != 'object')) return a === b
        const keys = Object.keys(a)
        //@ts-ignore
        return keys.length === Object.keys(b).length && keys.every(k => equal(a[k], b[k]))
      }
      const delta = (a[k] ||= { 0: [], 1: [] }),
        addR = delta[old ? 1 : 0],
        rmR = delta[old ? 0 : 1],
        idx = rmR.findIndex(x => equal(x, v))
      if (idx !== -1) rmR.splice(idx, 1)
      else addR.push(v)
      return a
    },
    function (acc, b) {
      return Object.keys(b).reduce((a, k) => {
        return Object.entries({ ...b[k] }).reduce(
          (a, [p, v]) =>
            v.reduce((a, v) => {
              //@ts-ignore
              const equal = (a, b) => {
                if ([a, b].some(a => !a || typeof a != 'object')) return a === b
                const keys = Object.keys(a)
                //@ts-ignore
                return keys.length === Object.keys(b).length && keys.every(k => equal(a[k], b[k]))
              }
              const delta = (a[k] ||= { 0: [], 1: [] }),
                addR = delta[p],
                rmR = delta[+p ? 0 : 1],
                idx = rmR.findIndex(x => equal(x, v))
              if (idx !== -1) rmR.splice(idx, 1)
              else addR.push(v)
              return a
            }, a),
          a,
        )
      }, acc || {})
    },
  )

export const $keys = <D extends O, C = unknown>(
  expr: Expr<Rec<string, number>, D, C>,
): Expr<Arr<string>, D, C> =>
  func<Arr<string>, [Record<string, number>], D, C>(function (obj) {
    return Object.keys(obj)
  }, expr)

export const $entries = <D extends O, V, C = unknown>(
  expr: Expr<Rec<string, Rec<'1' | '0', Arr<V>>>, D, C>,
) =>
  func<Arr<Rec<'k', string> & Rec<'v', V>>, [Rec<string, Rec<'1' | '0', Arr<V>>>], D, C>(function (
    obj,
  ) {
    return Object.entries({ ...obj }).flatMap(([k, v]) => v[0].map(v => ({ k, v })))
  }, expr)
