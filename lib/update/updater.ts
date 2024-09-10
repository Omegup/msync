import type { Arr, J, N, O, StrKey, Type, notArr, rawItem } from '../../types'
import { Field, type Path } from '../field'
import type { Expr } from '../types'

declare const Updater: unique symbol
export type Updater<in R, in T, out V, in C = unknown> = {
  [Type]?(x: typeof Updater, r: R, t: T, c: C): V
  readonly raw: <D extends J>(f: Field<D, R | N>) => readonly (readonly [string, rawItem])[]
}

export const subUpdater = <P extends J, D, T, V, Ctx>(
  a: Updater<D, T, V, Ctx>,
  f: Path<P, D | null>,
): Updater<P, T, V, Ctx> => ({ raw: <R extends J>(g: Field<R, P | N>) => a.raw(g.with(f)) })

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
      readonly [P in K]: F[K] extends Updater<R, infer O extends Old[K], infer A, C>
        ? A | Exclude<Old[K], O>
        : never
    },
  C
> => ({
  raw: f => Object.entries(fields).flatMap(([k, v]) => v.raw(f).map(([l, v]) => [`.${k}${l}`, v])),
})

export const weaken = <R, T, V, C = unknown>(
  updater: Updater<R, T, V, C>,
): Updater<R, T | null, V | null, C> => ({ raw: f => updater.raw(f) })


export const to = <R, V, C = unknown>(expr: Expr<V, R, C>): Updater<R, notArr, V, C> => ({
  raw: f => [['', expr.raw(f).get()]],
})
export const items = <R, T, V, C = unknown>(x: Updater<R, T, V, C>) =>
  x as {} as Updater<R, Arr<T>, Arr<V>, C>
