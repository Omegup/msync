import type { O, ReplaceQ, StrKey } from '../../../types'
import type { DeltaStages, Expr, LinStages } from '../../types'
import { setQ, type Updater, type UpdaterQHKT } from '../../update/updater'
import type { MapO } from '../../utils/map-object'
import { $replaceWith1, $replaceWith_, $set1, $set_ } from '../mongo-stages'
import { $replaceWithDelta, $setDelta } from './$set-delta'

const $setCore = <Q extends O, T extends Q, V extends Q, C = unknown>(
  updater: Updater<T, T, V, C>,
): DeltaStages<Q, T, V, C> & LinStages<Q, T, V, C> => ({
  delta: $setDelta(updater),
  raw: $set1<Q, T, V, C>(updater),
  lin: $set_(updater),
})

type V<VV, Q> = Exclude<StrKey<VV>, StrKey<Q>>
export type $Set<VV extends O, Q extends O> = <R extends Q, C = unknown>(
  fields: MapO<Omit<VV, StrKey<Q>>, UpdaterQHKT<R, R, VV, V<VV, Q>, C>, V<VV, Q>>,
) => DeltaStages<Q, R, Q & ReplaceQ<R, VV, Q>, C> & LinStages<Q, R, Q & ReplaceQ<R, VV, Q>, C>

export const $set: <VV extends O, Q extends O = O>() => $Set<VV, Q> =
  <VV extends O, Q extends O = O>() =>
  <R extends Q, C = unknown>(
    fields: MapO<Omit<VV, StrKey<Q>>, UpdaterQHKT<R, R, VV, V<VV, Q>, C>, V<VV, Q>>,
  ) =>
    $setCore<Q, R, Q & ReplaceQ<R, VV, Q>, C>(setQ<VV, Q>()(fields))

export const $replaceWith = <T extends O, V extends O>(
  expr: Expr<V, T>,
): DeltaStages<O, T, V> & LinStages<O, T, V> => ({
  delta: $replaceWithDelta(expr),
  raw: $replaceWith1(expr),
  lin: $replaceWith_(expr),
})
