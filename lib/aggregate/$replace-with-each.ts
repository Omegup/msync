import type { App, HKT, I, J, RORec, Rec, jsonItem } from '../../types'
import { eqTyped, ite, sub } from '../expression/logic'
import { nil } from '../expression/val'
import { root } from '../field'
import type { BA, Delta, Expr, RawStages } from '../types'
import { set, subUpdater, to, weaken, type Updater } from '../update'
import { $set_ } from './mongo-stages'

interface ParDeltaHKT<K extends BA, T extends J, E> extends HKT<jsonItem> {
  readonly out: RORec<K, I<jsonItem, this>> & Delta<T> & E
}

const deltaExpr =
  <T extends J, V extends jsonItem, E>(
    expr: <K extends BA>(field: K) => Expr<V, Rec<K, T> & Delta<T> & E>,
  ) =>
  <K extends BA>(field: K): Expr<V | null, Delta<T> & E> => {
    type F = ParDeltaHKT<K, T, E>
    return ite<V | null, null, T, F>(
      eqTyped<null, T, F, unknown>(root<Delta<T>>().of(field).expr(), nil),
      nil,
      expr(field),
    )
  }

export const $setEach = <T extends jsonItem, V extends jsonItem, E = unknown, C = unknown>(
  updater: <K extends BA>(k: K) => Updater<Delta<T> & E, T | null, V | null, C>,
) => {
  return $set_<Delta<T> & E, Delta<V> & Omit<E, BA>, C>(
    set({
      after: updater('after'),
      before: updater('before'),
    }),
  )
}

export const $replaceWithEach = <T extends J, V extends jsonItem, E>(
  expr: <K extends BA>(field: K) => Expr<V, Rec<K, T> & Delta<T> & E>,
): RawStages<Delta<T> & E, Delta<V> & Omit<E, BA>> => {
  const t = deltaExpr<T, V, E>(expr)
  return $setEach<T, V, E>(k => to(t(k)))
}

export const $replaceWithDelta = <T extends J, V extends jsonItem>(expr: Expr<V, T>) =>
  $replaceWithEach<T, V, unknown>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )

export const $setWithDelta = <T extends J, V extends J, C = unknown>(
  updater: Updater<T, T, V, C>,
) => $setEach(k => subUpdater(weaken(updater), root<Delta<T>>().of(k)))
