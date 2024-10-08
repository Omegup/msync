import type { HKT, I, IdHKT, J, RORec, Rec, jsonItem } from '../../../types'
import { eqTyped, ite } from '../../expression/logic'
import { nil } from '../../expression/val'
import { root } from '../../field'
import type { BA, Delta, Expr, RawStages } from '../../types'
import { set, to, type Updater } from '../../update'
import { $set1 } from '../mongo-stages'

export interface ParDeltaHKT<K extends BA, T extends jsonItem, E> extends HKT<jsonItem> {
  readonly out: RORec<K, I<jsonItem, this>> & Delta<T> & E
}

const deltaExpr =
  <T extends jsonItem, V extends jsonItem, E>(
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

export const $setEach1 = <T extends jsonItem, V extends jsonItem, E = unknown, C = unknown>(
  updater: <K extends BA>(k: K) => Updater<Delta<T> & E, T | null, V | null, C>,
) =>
  $set1<unknown, Delta<T> & E, Delta<V> & Omit<E, BA>, C>(
    set({
      after: updater('after'),
      before: updater('before'),
    }),
  )

export const $setEach = <T extends J, V extends jsonItem, E = unknown, C = unknown>(
  updater: (k: BA) => Updater<Delta<T> & E, T | null, V | null, C>,
): RawStages<unknown, Delta<T> & E, Delta<V> & Omit<E, BA>, C> =>
  $setEach1<T, V, E, C>(updater)<IdHKT<J>>(root)

export const $replaceWithEach = <T extends J, V extends jsonItem, E>(
  expr: <K extends BA>(field: K) => Expr<V, Rec<K, T> & Delta<T> & E>,
): RawStages<unknown, Delta<T> & E, Delta<V> & Omit<E, BA>> => {
  const t = deltaExpr<T, V, E>(expr)
  return $setEach<T, V, E>(k => to(t(k)))
}
