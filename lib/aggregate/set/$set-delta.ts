import type { App, N, O, RORec, jsonItem } from '../../../types'
import { sub } from '../../expression/logic'
import { nil } from '../../expression/val'
import { root } from '../../field'
import type { BA, Delta, Expr } from '../../types'
import { subUpdater, to, weaken, type Updater } from '../../update'
import { link } from '../prefix'
import { $replaceWithEach, $setEach, type ParDeltaHKT } from './$replace-with-each'

export const $replaceWithDelta = <T extends O, V extends jsonItem>(expr: Expr<V, T>) =>
  $replaceWithEach<T, V, unknown>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )

export const $setDelta = <T extends O, V extends O, C = unknown>(updater: Updater<T, T, V, C>) => {
  const dict = {
    after1: ['after1', 'after'],
    before1: ['before1', 'before'],
  } as const
  type BA1<T = V> = RORec<`${BA}1`, T | null>
  type DD = BA1 & Delta<T>
  const update = (k: BA) => subUpdater(weaken(updater), root<Delta<T>>().of(k))
  return link<Delta<T>, C>()
    .with<unknown, BA1<T> & Delta<T>>($setEach(k => to(root<Delta<T>>().of(k).expr()), dict))
    .with<unknown, BA1 & Delta<T>>($setEach<T, V, `${BA}1`, unknown, C>(update, dict))
    .with<unknown, Delta<V> & BA1>($replaceWithEach(field => root<DD>().of(`${field}1`).expr()))
    .with<unknown, Delta<V>>($setEach<V, V, `${BA}1`, unknown, C>(k => to(nil), dict)).stages
}
