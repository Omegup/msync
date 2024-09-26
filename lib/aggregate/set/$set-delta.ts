import type { App, J, jsonItem } from '../../../types'
import { sub } from '../../expression/logic'
import { root } from '../../field'
import type { BA, Delta, Expr } from '../../types'
import { subUpdater, weaken, type Updater } from '../../update'
import { $replaceWithEach, $setEach, type ParDeltaHKT } from './$replace-with-each'

export const $replaceWithDelta = <Q, T extends Q & J, V extends Q & jsonItem>(expr: Expr<V, T>) =>
  $replaceWithEach<Q, T, V, unknown>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )

export const $setDelta = <Q, T extends Q & J, V extends Q & jsonItem, C = unknown>(
  updater: Updater<T, T, V, C>,
) => $setEach<Q, T, V, unknown, C>(k => subUpdater(weaken(updater), root<Delta<T>>().of(k)))
