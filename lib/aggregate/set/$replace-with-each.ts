import type { ConstHKT, HKT, I, IdHKT, N, O, RORec, Rec, jsonItem } from '../../../types'
import { $ifNull, eqTyped, ite } from '../../expression/logic'
import { nil } from '../../expression/val'
import { root } from '../../field'
import type { BA, Delta, Expr, FRawStages, RawStages } from '../../types'
import { set, to, type Updater, type UpdaterHKT } from '../../update/updater'
import { mapExact1, type MapK } from '../../utils/map-object'
import { $set1 } from '../mongo-stages'

export interface ParDeltaHKT<K extends BA, T extends jsonItem, E> extends HKT<jsonItem> {
  readonly out: RORec<K, I<jsonItem, this>> & Delta<T> & E
}

const deltaExpr =
  <T extends jsonItem, V extends jsonItem, E>(
    expr: <K extends BA>(field: K) => Expr<V | null, Rec<K, T> & Delta<T> & E>,
  ) =>
  <K extends BA>(field: K): Expr<V | null, Delta<T> & E> => {
    type F = ParDeltaHKT<K, T, E>
    return ite<V | null, null, T, F>(
      eqTyped<null, T, F, unknown>($ifNull(root<Delta<T>>().of(field).expr()), nil),
      nil,
      expr(field),
    )
  }

type Delta2<T extends jsonItem, BA2 extends string> = Delta<T> & Partial<RORec<BA2, T | null>>
export const $setEach1 = <
  T extends jsonItem,
  V extends jsonItem,
  BA2 extends string,
  E = unknown,
  C = unknown,
>(
  updater: (k: BA) => Updater<Delta<T> & Partial<RORec<BA2, T | null>> & E, T | N, V | null, C>,
  dict: MapK<BA2, ConstHKT<BA>>,
): FRawStages<unknown, Delta2<T, BA2> & E, Rec<BA2, V | null> & Omit<Delta<T> & E, BA2>, C, 1> => {
  type R = Delta<T> & Partial<RORec<BA2, T | null>> & E
  type DV = RORec<BA2, V | null>
  return $set1<unknown, R, Rec<BA2, V | null> & Omit<R, BA2>, C>(
    set<DV>()<R, R, C, BA2>(
      mapExact1<BA2, ConstHKT<BA>, UpdaterHKT<R, R, DV, C, BA2>>(dict, updater),
    ),
  )
}
export const $setEach = <
  T extends O,
  V extends jsonItem,
  BA2 extends string,
  E = unknown,
  C = unknown,
>(
  updater: (k: BA) => Updater<Delta<T> & E, T | N, V | null, C>,
  dict: MapK<BA2, ConstHKT<BA>>,
): RawStages<unknown, Delta2<T, BA2> & E, Rec<BA2, V | null> & Omit<Delta<T> & E, BA2>, C, 1> =>
  $setEach1<T, V, BA2, E, C>(updater, dict)<IdHKT<O>>(root)

export const $replaceWithEach = <T extends O, V extends jsonItem, E = unknown>(
  expr: <K extends BA>(field: K) => Expr<V | null, Rec<K, T> & Delta<T> & E>,
): RawStages<unknown, Delta<T> & E, Delta<V> & Omit<E, BA>> => {
  const t = deltaExpr<T, V, E>(expr)
  return $setEach<T, V, BA, E>(k => to(t(k)), {
    after: ['after', 'after'],
    before: ['before', 'before'],
  })
}
