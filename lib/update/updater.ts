import type { Arr, JsonObj, O, Type, notArr, rawItem } from '../../types'
import { root } from '../field'
import type { Expr } from '../types'

declare const FieldUpdaterRaw: unique symbol
export type FieldUpdaterRaw<in R, in T, out V> = {
  [Type]?(x: typeof FieldUpdaterRaw, c: R, t: T): V
  raw: readonly (readonly [string, rawItem])[]
}

type Par<K extends string> = { [P in K]?: unknown }
export const set = <
  R,
  Old extends Par<K>,
  F extends { readonly [P in K]: FieldUpdaterRaw<R, Old[K], unknown> },
  K extends string = string & keyof F,
>(
  fields: F,
): FieldUpdaterRaw<
  R,
  Old,
  Omit<Old, K> &
    O & {
      readonly [P in K]: F[K] extends FieldUpdaterRaw<R, Old[K], infer A> ? A : never
    }
> => ({
  raw: Object.entries(fields).flatMap(([k, v]) => v.raw.map(([l, v]) => [`.${k}${l}`, v])),
})
export const to = <R extends JsonObj, V>(
  expr: Expr<V, R, unknown>,
): FieldUpdaterRaw<R, notArr, V> => ({
  raw: [['', expr.raw(root<R>())]],
})
export const items = <R, T, V>(x: FieldUpdaterRaw<R, T, V>) =>
  x as {} as FieldUpdaterRaw<R, Arr<T>, Arr<V>>
