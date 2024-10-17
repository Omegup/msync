import type { J, doc } from '../../../types'
import type { DeltaStages, Expr, LinStages } from '../../types'
import type { Updater } from '../../update'
import { $replaceWith1, $replaceWith_, $set1, $set_ } from '../mongo-stages'
import { $replaceWithDelta, $setDelta } from './$set-delta'

export const $set = <Q, T extends Q & doc, V extends Q & doc, C = unknown>(
  updater: Updater<T, T, V, C>,
): DeltaStages<Q, T, V, C> & LinStages<Q, T, V, C> => ({
  delta: $setDelta(updater),
  raw: $set1<Q, T, V, C>(updater),
  lin: $set_(updater),
})

export const $replaceWith = <T extends J, V extends J>(
  expr: Expr<V, T>,
): DeltaStages<J, T, V> & LinStages<J, T, V> => ({
  delta: $replaceWithDelta(expr),
  raw: $replaceWith1(expr),
  lin: $replaceWith_(expr),
})
