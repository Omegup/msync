import type { App, O, Rec, jsonItem } from '../../../types'
import { sub } from '../../expression/logic'
import { nil } from '../../expression/val'
import { root } from '../../field'
import type { BA, Delta, Expr, PreDelta, RawStages } from '../../types'
import { subUpdater, to, weaken, type Updater } from '../../update/updater'
import { link } from '../prefix'
import { $replaceWithEach, $setEach, type ParDeltaHKT } from './$replace-with-each'

export const $replaceWithDelta = <T extends O, V extends jsonItem>(
  expr: Expr<V, T>,
): RawStages<unknown, Delta<T>, Delta<V>> =>
  $replaceWithEach<T, V>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )

export const $setDelta = <T extends O, V extends O, C = unknown>(updater: Updater<T, T, V, C>) => {
  const dict = {
    after1: ['after1', 'after'],
    before1: ['before1', 'before'],
  } as const
  type BA1<X = V> = Rec<`${BA}1`, X | null>
  type DD = BA1 & Delta<T>
  const side = (k: BA) => root<Delta<T>>().of<PreDelta<T | null>, BA>(k)
  const update = (k: BA) => subUpdater(weaken(updater), side(k))
  return link<Delta<T>, C>()
    .with<unknown, BA1<T> & Delta<T>>(
      $setEach<T, T, `${BA}1`, unknown, C>(k => to(side(k).expr()), dict),
    )
    .with<unknown, BA1 & Delta<T>>($setEach<T, V, `${BA}1`, unknown, C>(update, dict))
    .with<unknown, Delta<V> & BA1>(
      $replaceWithEach<T, V, BA1>(field => root<DD>().of<BA1, `${BA}1`>(`${field}1`).expr()),
    )
    .with<unknown, Delta<V>>($setEach<V, V, `${BA}1`, unknown, C>(k => to(nil), dict)).stages
}
