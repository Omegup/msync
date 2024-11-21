import type { App, doc, Literal, HKT, I, ID, O, RemoveSignature, StrKey } from '../../../types'
import type { DeltaStages, Expr, LinStages } from '../../types'
import { set, type Updater, type UpdaterHKT } from '../../update'
import { doubleExclude, renamedFields, type Equal } from '../../utils/guard'
import type { MapK } from '../../utils/map-object'
import { $replaceWith1, $replaceWith_, $set1, $set_ } from '../mongo-stages'
import { $replaceWithDelta, $setDelta } from './$set-delta'

const $setCore = <Q, T extends Q & O, V extends Q & ID & O, C = unknown>(
  updater: Updater<T, T, V, C>,
): DeltaStages<Q, T, V, C> & LinStages<Q, T, V, C> => ({
  delta: $setDelta(updater),
  raw: $set1<Q, T, V, C>(updater),
  lin: $set_(updater),
})

type RmId<V> = Omit<RemoveSignature<V>, '_id'> & O
type Replace<R, V> = Omit<R, StrKey<V>> & V & doc
export const $set =
  <V extends O>() =>
  <R extends doc, C = unknown>(
    fields: MapK<StrKey<RmId<V>>, UpdaterHKT<R, R, RmId<V>, C>>,
  ): DeltaStages<O, R, Replace<R, V>, C> & LinStages<O, R, Replace<R, V>, C> => {
    return $setCore<O, R, Replace<R, V>, C>(set<V>()(fields))
  }

export const $replaceWith = <T extends O, V extends O>(
  expr: Expr<V, T>,
): DeltaStages<O, T, V> & LinStages<O, T, V> => ({
  delta: $replaceWithDelta(expr),
  raw: $replaceWith1(expr),
  lin: $replaceWith_(expr),
})
