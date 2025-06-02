import { type Timestamp } from 'mongodb'
import type { N, O, RORec, StrKey, View } from '../../types'
import type { ConstHKT, IdHKT } from '../../types/hkt'
import { $match_, $project_ } from '../aggregate/mongo-stages'
import { link, type Concat } from '../aggregate/prefix'
import { root } from '../field'
import { $eq, $exists, $gtTs } from '../predicate'
import { $expr } from '../predicate/$expr'
import { $and } from '../query/logic'
import type { Query } from '../types'
import type { D, Del, Model, RawStages } from '../types/stream'
import { mapExactToObject, spread } from '../utils/map-object'
import type { Allowed } from './boot-utils'

export const getFirstStages = <V extends Model, KK extends StrKey<V>>(
  view: View<V, Allowed<KK>>,
) => {
  type K = Allowed<KK>
  type WithDel = 'deletedAt' | '_id' | Exclude<K, 'deletedAt' | '_id'>

  const { projection, hardMatch: pre, match } = view
  const projectInput = $project_<V, WithDel>(
    spread<RORec<K, 1>, RORec<'deletedAt' | '_id', 1>, IdHKT>(projection, {
      deletedAt: ['deletedAt', 1],
      _id: ['_id', 1],
    }),
  )

  const removeNotYetSynchronizedFields: readonly Query<V>[] = Object.values(
    mapExactToObject<RORec<K, 1>, IdHKT, ConstHKT<Query<V> | null>>(projection, (_, k) =>
      k.startsWith('_') ? root<V>().of(k).has($exists(true)) : null,
    ),
  )
  const hardMatch = $and(pre, ...removeNotYetSynchronizedFields)

  const firstStages = (
    lastTS: { ts: Timestamp } | null,
    keepNulls = false,
  ): Concat<V | O | Del, Del | V, V, unknown> => {
    const hardQuery = $and(
      lastTS
        ? root<Model>().of('touchedAt').has($gtTs(lastTS.ts))
        : root<D>().of('deletedAt').has($eq<Timestamp | N>(null)),
      lastTS ? null : match && $expr(match),
      keepNulls ? pre : hardMatch,
    )
    return link<V | Del>()
      .with($match_(hardQuery) as RawStages<O, V | Del, V>)
      .with(projectInput)
  }
  return { firstStages, hardMatch }
}

