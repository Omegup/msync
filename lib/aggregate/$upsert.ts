import type { RWCollection } from '../../types'
import type { ID, N, O, doc } from '../../types/json'
import { mergeObjects } from '../expression/array'
import { field } from '../expression/concat'
import { eq, ite } from '../expression/logic'
import { current, nil } from '../expression/val'
import { root } from '../field'
import type { Del, Delta, Expr, RawStages, StreamRunnerParam, TS } from '../types'
import { id } from '../utils/json'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

type ND = { readonly deletedAt?: null }
export type Merge<T extends ID> = (T & ND & TS) | Del

export const $insertX = <T extends doc, D extends O>(
  out: RWCollection<Merge<T>>,
  expr: Expr<T, D>,
  map: (x: Expr<T & ND & TS, D>) => Expr<Merge<T>, D>,
): StreamRunnerParam<D, 'out'> => ({
  teardown: c =>
    c({
      collection: out,
      method: 'updateMany',
      params: [{}, [{ $set: { deletedAt: '$$NOW', touchedAt: '$$CLUSTER_TIME' } }]],
    }),
  raw: (): RawStages<unknown, D, 'out'> => {
    const replacer = map(
      mergeObjects<T, ND & TS, D>(
        expr,
        field({ deletedAt: ['deletedAt', nil], touchedAt: ['touchedAt', current] }),
      ),
    )

    return link<D>()
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

export const $simpleInsert = <T extends doc>(
  out: RWCollection<Merge<T>>,
): StreamRunnerParam<T, 'out'> => $insertX(out, root<T>().expr(), id)

export const $insert = <T extends doc>(
  out: RWCollection<Merge<T>>,
): StreamRunnerParam<Delta<T>, 'out'> =>
  $insertX<T, Delta<T>>(out, assertNotNull(root<Delta<T>>().of('after').expr()), x =>
    ite<Merge<T>, Delta<T>>(
      eq(root<Delta<T>>().of('after').expr())(nil),
      field<Del, Delta<T>>({
        deletedAt: ['deletedAt', current],
        _id: ['_id', assertNotNull(root<Delta<doc>>().of('before').of('_id').expr())],
        touchedAt: ['touchedAt', current],
      }),
      x,
    ),
  )

const assertNotNull = <T, D, C>(expr: Expr<T | N, D, C>) => expr as Expr<T, D, C>
