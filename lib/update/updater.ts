import type {
  App,
  Arr,
  ConstHKT,
  HKT,
  I,
  J,
  N,
  O,
  StrKey,
  Type,
  notArr,
  rawItem
} from '../../types'
import { Field, type Path } from '../field'
import type { Expr } from '../types'
import { mapExactToObject } from '../utils/map-object'

declare const Updater: unique symbol
export type Updater<in R, in T, out V, in C = unknown> = {
  [Type]?(x: typeof Updater, r: R, t: T, c: C): V
  readonly raw: <D extends J>(f: Field<D, R | N>) => readonly (readonly [string, rawItem])[]
}

export const subUpdater = <P extends J, D, T, V, Ctx>(
  a: Updater<D, T, V, Ctx>,
  f: Path<P, D | N>,
): Updater<P, T, V, Ctx> => ({ raw: <R extends J>(g: Field<R, P | N>) => a.raw(g.with(f)) })

interface UpdaterHKT<F extends FDom<F, R, C>, R, C> extends HKT<F[StrKey<F>]> {
  readonly out: Updater<
    R,
    I<F[StrKey<F>], this>[1] extends Updater<R, infer T, unknown, C> ? T : never,
    I<F[StrKey<F>], this>[1] extends Updater<R, never, infer V, C> ? V : never,
    C
  >
}

type ExactPart<T, F extends HKT<T[StrKey<T>]>> = {
  readonly [K in StrKey<T>]: readonly [K, App<F, T[K]>]
}
// ExactPart
type FDom<F extends FDom<F, R, C>, R, C> = ExactPart<F, UpdaterHKT<F, R, C>>
type Get<T, P extends string> = P extends keyof T ? T[P] : undefined

export const set = <R, Old, F extends FDom<F, R, C>, C = unknown>(
  fx: F,
): Updater<
  R,
  Old,
  Omit<Old, StrKey<F>> &
    O<{
      readonly [P in StrKey<F>]: F[P][1] extends Updater<R, infer O extends Get<Old, P>, infer A, C>
        ? A | Exclude<Get<Old, P>, O>
        : never
    }>,
  C
> => ({
  raw: f =>
    Object.entries(mapExactToObject<F, UpdaterHKT<F, R, C>, ConstHKT<1>>(fx, () => 1)).flatMap(
      ([k]) => fx[k][1].raw(f).map(([l, v]) => [`.${k}${l}`, v]),
    ),
})
export const set1 =
  <R>() =>
  <F extends FDom<F, R, C>, Old, C = unknown>(fields: F) =>
    set<R, Old, F, C>(fields)

export const weaken = <R, T, V, C = unknown>(
  updater: Updater<R, T, V, C>,
): Updater<R, T | null, V | null, C> => ({ raw: f => updater.raw(f) })

export const to = <R, V, C = unknown>(expr: Expr<V, R, C>): Updater<R, notArr, V, C> => ({
  raw: f => [['', expr.raw(f).get()]],
})
export const items = <R, T, V, C = unknown>(x: Updater<R, T, V, C>) =>
  x as {} as Updater<R, Arr<T>, Arr<V>, C>
