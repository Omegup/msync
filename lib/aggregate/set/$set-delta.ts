import type { App, J, jsonItem } from '../../../types'
import { sub } from '../../expression/logic'
import { root } from '../../field'
import type { BA, Delta, Expr } from '../../types'
import { subUpdater, weaken, type Updater } from '../../update'
import { $replaceWithEach, $setEach, type ParDeltaHKT } from './$replace-with-each'


export const $replaceWithDelta = <T extends J, V extends jsonItem>(expr: Expr<V, T>) =>
  $replaceWithEach<T, V, unknown>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )

export const $setDelta = <T extends J, V extends J, C = unknown>(
  updater: Updater<T, T, V, C>,
) => $setEach(k => subUpdater(weaken(updater), root<Delta<T>>().of(k)))
