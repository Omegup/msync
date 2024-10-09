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

export const $setDelta = <T extends J, V extends jsonItem, C = unknown>(
  updater: Updater<T, T, V, C>,
) => $setEach<T, V, unknown, C>(k => subUpdater(weaken(updater), root<Delta<T>>().of(k)))

const ss = [
  {
    let: { a: '$after', b: '$before' },
    pipeline: [
      {
        $documents: { $filter: { input: ['$$a', '$$b'], as: 'x', cond: '$$x' } },
      },
      {
        $set: {},
      },
      {
        $group: { _id: '', docs: { $push: '$$ROOT' } },
      },
      {
        $replaceWith: {
          after: { $cond: { if: '$$a', then: { $first: '$docs' }, else: null } },
          before: { $cond: { if: '$$b', then: { $last: '$docs' }, else: null } },
        },
      },
    ],
    as: 'root',
  },

  { $mergeObjects: [{ _id: '$_id' }, { $first: '$root' }] },
]
