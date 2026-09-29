import type { AppMap, ConstHKT, N, O, PRRec, RawObj, rawItem } from '../../types'
import { add, subtract } from '../expression/arith'
import type { ExprHKT } from '../expression/concat'
import { $ifNull, ite, sub } from '../expression/logic'
import { func, val, type AddO } from '../expression/val'
import { root } from '../field'
import type { Accumulator, AccumulatorRaw, DeltaAccumulator, Expr, Part } from '../types'

type AddOs<A extends readonly unknown[]> = {[K in keyof A]: AddO<A[K]>}
type PushSides<V> = { 0: V[]; 1: V[] }
type PushDict<V> = PRRec<string, PushSides<V>>

const asAccumulator = <T, V, C = unknown>(x: RawObj) => x as AccumulatorRaw<T, V, C>

const $sum_ = <D extends O, C = unknown>(
  expr: Expr<number | N, D, C>,
): Accumulator<D, number, C> => ({ raw: f => asAccumulator({ $sum: expr.raw(f).get() }) })
export const $sum = <D extends O, C = unknown>(
  expr: Expr<number | N, D, C>,
): DeltaAccumulator<D, number, C> => ({
  group: $sum_(
    ite(
      root<Part<D>>().of('deleted').expr(),
      val(0),
      ite(
        root<Part<D>>().of('old').expr(),
        subtract(val(0), $ifNull(sub(expr, root<Part<D>>().of('v')), val(0))),
        sub(expr, root<Part<D>>().of('v')),
      ),
    ),
  ),
  merge: (x, y) => add($ifNull(x, val(0)), y),
})

const $accumulator_ = <D, T, Ctx, A extends readonly unknown[]>(
  init: () => T,
  accumulateArgs: AppMap<ExprHKT<D, Ctx>, AddOs<A>>,
  accumulate: (a: T, ...args: A) => T,
  merge: (...args: [T, T]) => T,
): Accumulator<D, AddO<T>, Ctx> => {
  return {
    raw: f =>
      asAccumulator({
        $accumulator: {
          init: init.toString(),
          initArgs: [],
          accumulate: accumulate.toString(),
          accumulateArgs: accumulateArgs.map<AddOs<A>, ExprHKT<D, Ctx>, ConstHKT<rawItem>, 1>(e =>
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
  accumulateArgs: AppMap<ExprHKT<Part<D>, Ctx>, AddOs<A>>,
  accumulate: (a: T, ...args: A) => T,
  merge: (...args: [T | N, T]) => T,
): DeltaAccumulator<D, AddO<T>, Ctx> => ({
  group: $accumulator_(init, accumulateArgs, accumulate, merge),
  merge: <D, C>(a: Expr<AddO<T> | N, D, C>, b: Expr<AddO<T>, D, C>): Expr<AddO<T>, D, C> =>
    func<T, [T | N, T], D, C>(merge, a, b),
})

export const $countDict = <D extends O, K extends string = string, C = unknown>(
  expr: Expr<AddO<K>, D, C>,
): DeltaAccumulator<D, AddO<PRRec<K, number>>, C> =>
  $accumulator<D, PRRec<K, number>, C, [K, boolean, true | N]>(
    function () {
      return {}
    },
    [
      sub(expr, root<Part<D>>().of('v')),
      root<Part<D>>().of('old').expr(),
      root<Part<D>>().of('deleted').expr(),
    ],
    function (a, k, old, deleted) {
      if (deleted) return a
      let y = (a[k] || 0) + (old ? -1 : 1)
      return y ? (a[k] = y) : delete a[k], a
    },
    function (a, b) {
      return Object.keys(b).reduce<PRRec<K, number>>((a, k) => {
        let y = (a[k] || 0) + b[k]!
        return y ? (a[k] = y) : delete a[k], a
      }, a || {})
    },
  )
export const $countDictArray = <D extends O, K extends string = string, C = unknown>(
  expr: Expr<AddO<K[]>, D, C>,
): DeltaAccumulator<D, AddO<PRRec<K, number>>, C> =>
  $accumulator<D, PRRec<K, number>, C, [K[], boolean, true | N]>(
    function () {
      return {}
    },
    [
      sub(expr, root<Part<D>>().of('v')),
      root<Part<D>>().of('old').expr(),
      root<Part<D>>().of('deleted').expr(),
    ],
    function (a, keys, old, deleted) {
      if (deleted) return a
      keys.forEach(k => {
        const y = (a[k] || 0) + (old ? -1 : 1)
        if (y) a[k] = y
        else delete a[k]
      })
      return a
    },
    function (a, b) {
      return Object.keys(b).reduce<PRRec<K, number>>((a, k) => {
        let y = (a[k] || 0) + b[k]!
        return y ? (a[k] = y) : delete a[k], a
      }, a || {})
    },
  )
export const $pushDict = <D extends O, V, C = unknown>(
  key: Expr<string, D, C>,
  value: Expr<AddO<V>, D, C>,
) =>
  // '1' => 'old'
  $accumulator<D, PushDict<V>, C, [string, V, boolean, true | N]>(
    function () {
      return {}
    },
    [
      sub(key, root<Part<D>>().of('v')),
      sub(value, root<Part<D>>().of('v')),
      root<Part<D>>().of('old').expr(),
      root<Part<D>>().of('deleted').expr(),
    ],
    function (ra, k, v, old, deleted) {
      if (deleted) return ra
      let a: PRRec<string, PushSides<V>> = { ...ra }
      //@ts-ignore
      const equal = (a, b) => {
        if (!a || !b) return a === b
        if (a instanceof Date) return b instanceof Date && a.getTime() === b.getTime()
        if ([a, b].some(a => Object.getPrototypeOf(a) != Object.prototype)) return a.valueOf() === b.valueOf()
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
    function (acc: PushDict<V> | N, b: PushDict<V>): PushDict<V> {
      return Object.keys(b).reduce<PushDict<V>>((a, k) => {
        return Object.entries({ ...b[k] }).reduce<PushDict<V>>(
          (a, [p, v]) =>
            v!.reduce<PushDict<V>>((a, v) => {
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

export const $keys = <D extends O, K extends string = string, C = unknown>(
  expr: Expr<AddO<PRRec<K, number>>, D, C>,
): Expr<AddO<K[]>, D, C> =>
  func<K[], [PRRec<K, number>], D, C>(function (obj) {
    return Object.keys(obj) as K[]
  }, expr)

export const $entries = <D extends O, V, C = unknown>(
  expr: Expr<AddO<PushDict<V>>, D, C>,
): Expr<AddO<{ k: string; v: V }[]>, D, C> =>
  func<{ k: string; v: V }[], [PushDict<V>], D, C>(function (obj) {
    return Object.entries({ ...obj }).flatMap(([k, v]) => (v as PushSides<V>)[0].map(v => ({ k, v })))
  }, expr)
