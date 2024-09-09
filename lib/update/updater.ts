import type { Arr, J, O, StrKey, Type, notArr, rawItem } from '../../types'
import { Field } from '../field'
import type { Expr } from '../types'

declare const Updater: unique symbol
export type Updater<in R, in T, out V, in C = unknown> = {
  [Type]?(x: typeof Updater, r: R, t: T, c: C): V
  readonly raw: <D extends J>(f: Field<D, R>) => readonly (readonly [string, rawItem])[]
}

type FDom<R, C> = { readonly [P: string]: Updater<R, never, unknown, C> }
type Par<K extends string> = { [P in K]?: unknown }
export const set = <
  R,
  Old extends Par<K>,
  F extends FDom<R, C>,
  K extends StrKey<F> = StrKey<F>,
  C = unknown,
>(
  fields: F,
): Updater<
  R,
  Old,
  Omit<Old, K> &
    O & {
      readonly [P in K]: F[K] extends Updater<R, Old[K], infer A, C> ? A : never
    },
  C
> => ({
  raw: f => Object.entries(fields).flatMap(([k, v]) => v.raw(f).map(([l, v]) => [`.${k}${l}`, v])),
})
export const to = <R extends J, V, C = unknown>(
  expr: Expr<V, R, C>,
): Updater<R, notArr, V, C> => ({
  raw: f => [['', expr.raw(f).get()]],
})
export const items = <R, T, V, C = unknown>(x: Updater<R, T, V, C>) =>
  x as {} as Updater<R, Arr<T>, Arr<V>, C>
