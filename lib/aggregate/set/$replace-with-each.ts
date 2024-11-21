import type { HKT, I, ID, IdHKT, O, RORec, Rec, StrKey, jsonItem } from '../../../types'
import { eqTyped, ite } from '../../expression/logic'
import { nil, val } from '../../expression/val'
import { root } from '../../field'
import type { BA, Delta, Expr, RawStages } from '../../types'
import { set, to, type Updater, type UpdaterHKT } from '../../update'
import type { MapK } from '../../utils/map-object'
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
  updater: (k: BA) => Updater<Delta<T> & E, T | null, V | null, C>,
) =>{
  const ss: Updater<Delta<T> & E, Delta<T> & E, Omit<Delta<T> & E, BA | '_id'> & Delta<V>, C> = set<Delta<V>>()<Delta<T> & E, Delta<T> & E, C, BA>({
    after: ['after', updater('after')],
    before: ['before', updater('before')],
    _id: ['_id', to(val(''))],
  })

  type VV = {readonly before: V | null, readonly after: V | null, }

  const ezfe: MapK<StrKey<VV>, UpdaterHKT<Delta<T> & E, Delta<T> & E, VV, C, never>> = {
    after: ['after', updater('after')],
    before: ['before', updater('before')],

  }
  return $set1<unknown, Delta<T> & E, Delta<V> & Omit<E, BA>, C>(
    set<{readonly before: V | null, readonly after: V | null, }>()<Delta<T> & E, Delta<T> & E, C>(ezfe)
  )
}
export const $setEach = <T extends O, V extends jsonItem, E = unknown, C = unknown>(
  updater: (k: BA) => Updater<Delta<T> & E, T | null, V | null, C>,
): RawStages<unknown, Delta<T> & E, Delta<V> & Omit<E, BA>, C> =>
  $setEach1<T, V, E, C>(updater)<IdHKT<O>>(root)

export const $replaceWithEach = <T extends O, V extends jsonItem, E>(
  expr: <K extends BA>(field: K) => Expr<V, Rec<K, T> & Delta<T> & E>,
): RawStages<unknown, Delta<T> & E, Delta<V> & Omit<E, BA>> => {
  const t = deltaExpr<T, V, E>(expr)
  return $setEach<T, V, E>(k => to(t(k)))
}
