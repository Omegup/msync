import type { Arr, J, N, O, StrKey, Type, notArr, rawItem } from '../../types'
import { Field, type Path } from '../field'
import type { Expr } from '../types'

declare const Updater: unique symbol
export type Updater<in R, out Q, in T extends Q, out V extends Q, in C = unknown> = {
  [Type]?(x: typeof Updater, r: R, t: T, c: C): V
  readonly raw: <D extends J>(f: Field<D, R | N>) => readonly (readonly [string, rawItem])[]
}

export const subUpdater = <P extends J, D, Q, T extends Q, V extends Q, Ctx>(
  a: Updater<D, Q, T, V, Ctx>,
  f: Path<P, D | N>,
): Updater<P, Q, T, V, Ctx> => ({ raw: <R extends J>(g: Field<R, P | N>) => a.raw(g.with(f)) })

type FDom<R, C> = { readonly [P: string]: Updater<R, unknown, never, unknown, C> }
type Par<K extends string> = { readonly [P in K]?: unknown }
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
  Omit<Old, K>,
  Old,
  Omit<Old, K> &
    O & {
      readonly [P in K]: F[P] extends Updater<R, unknown, infer O extends Old[P], infer A, C>
        ? A | Exclude<Old[P], O>
        : never
    },
  C
> => ({
  raw: f => Object.entries(fields).flatMap(([k, v]) => v.raw(f).map(([l, v]) => [`.${k}${l}`, v])),
})

export const weaken = <R, Q, T extends Q, V extends Q, C = unknown>(
  updater: Updater<R, Q, T, V, C>,
): Updater<R, Q | null, T | null, V | null, C> => ({ raw: f => updater.raw(f) })

export const to = <R, V, C = unknown>(expr: Expr<V, R, C>): Updater<R, unknown, notArr, V, C> => ({
  raw: f => [['', expr.raw(f).get()]],
})
export const items = <R, Q, T extends Q, V extends Q, C = unknown>(x: Updater<R, Q, T, V, C>) =>
  x as {} as Updater<R, Arr<Q>, Arr<T>, Arr<V>, C>
