import type { App, HKT, I, JsonObj, RORec, Rec, jsonItem } from '../../types'
import { eqTyped, ite, sub } from '../expression/logic'
import { nil } from '../expression/val'
import { root } from '../field'
import type { BA, Delta, Expr, RawStages } from '../types'
import { set, to } from '../update'
import { $set_ } from './mongo-stages'

type J = JsonObj
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

export const $replaceWithEach = <T extends J, V extends jsonItem, E>(
  expr: <K extends BA>(field: K) => Expr<V, Rec<K, T> & Delta<T> & E>,
): RawStages<Delta<T> & E, Delta<V>> => {
  const t = deltaExpr<T, V, E>(expr)
  return $set_<Delta<T> & E, Delta<V>>(
    set({
      after: to(t('after')),
      before: to(t('before')),
    }),
  )
}

export const $replaceWithDelta = <T extends J, V extends jsonItem>(expr: Expr<V, T>) =>
  $replaceWithEach<T, V, unknown>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )
