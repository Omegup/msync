import type { J } from '../../../types'
import type { DeltaStages, Expr, LinStages } from '../../types'
import type { Updater } from '../../update'
import { $replaceWith1, $replaceWith_, $set1, $set_ } from '../mongo-stages'
import { $replaceWithDelta, $setDelta } from './$set-delta'

export const $set = <T extends J, V extends J, C = unknown>(
  updater: Updater<T, T, V, C>,
): DeltaStages<T, V, C> & LinStages<T, V, C> => ({
  delta: $setDelta(updater),
  raw: $set1(updater),
  lin: $set_(updater),
})

export const $replaceWith = <T extends J, V extends J>(
  expr: Expr<V, T>,
): DeltaStages<T, V> & LinStages<T, V> => ({
  delta: $replaceWithDelta(expr),
  raw: $replaceWith1(expr),
  lin: $replaceWith_(expr),
})
