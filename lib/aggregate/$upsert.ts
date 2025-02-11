import type { RWCollection } from '../../types'
import type { ID, N, O, doc } from '../../types/json'
import { mergeObjects } from '../expression/array'
import { field } from '../expression/concat'
import { eq, ite } from '../expression/logic'
import { current, nil } from '../expression/val'
import { root } from '../field'
import type { Del, Delta, Expr, RawStages, StreamRunnerParam, TS } from '../types'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

type ND = { readonly deletedAt?: null }
export type Merge<T extends ID> = (T & ND & TS) | Del

export const $upsert = <T extends doc>(
  out: RWCollection<Merge<T>>,
): StreamRunnerParam<Delta<T>, 'out'> => ({
  teardown: c =>
    c({
      collection: out,
      method: 'updateMany',
      params: [{}, [{ $set: { deletedAt: '$$NOW', touchedAt: '$$CLUSTER_TIME' } }]],
    }),
  raw: (): RawStages<unknown, Delta<T>, 'out'> => {
    const replacer = ite<Merge<T>, Delta<T>>(
      eq(root<Delta<T>>().of('after').expr())(nil),
      field<Del, Delta<T>>({
        deletedAt: ['deletedAt', current],
        _id: ['_id', assertNotNull(root<Delta<doc>>().of('before').of('_id').expr())],
        touchedAt: ['touchedAt', current],
      }),
      mergeObjects<T, ND & TS, Delta<T>>(
        assertNotNull(root<Delta<T>>().of('after').expr()),
        field({ deletedAt: ['deletedAt', nil], touchedAt: ['touchedAt', current] }),
      ),
    )
    return link<Delta<T>>()
      .with<unknown, Merge<T>>($replaceWith_(replacer))
      .with<unknown, 'out'>(
        $merge_<Merge<T>, Merge<T>>({
          into: out,
          on: root<O<ID>>().of('_id'),
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        }),
      ).stages
  },
})
const assertNotNull = <T, D, C>(expr: Expr<T | N, D, C>) => expr as Expr<T, D, C>
