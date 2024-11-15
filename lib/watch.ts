import type { BSON, Db, Timestamp } from 'mongodb'
import type { O, StrKey, View } from '../types'
import { sub } from './expression/logic'
import { root, type Field } from './field'
import { $or } from './query/logic'
import type { Model, Query } from './types'
import { mapExactToObject } from './utils/map-object'

export const changeKeys = ['fullDocument', 'fullDocumentBeforeChange'] as const
export type ChangeKey = (typeof changeKeys)[number]

export type Change<T extends Model> = O<{
  readonly fullDocument: T
  readonly fullDocumentBeforeChange: T
}>
export const subQ = <D extends O, C, DeltaD extends O>(
  a: Query<D, C>,
  f: Field<DeltaD, D>,
): Query<DeltaD, C> => ({ raw: g => a.raw(g.with(f)), expr: sub(a.expr, f) })

export const makeWatchStream = <V extends Model, K extends StrKey<V>>(
  db: Db,
  { collection, match, projection: p, hardMatch }: View<V, K>,
  startAt: Timestamp,
) => {
  const projection = mapExactToObject(p, v=>v)
  const pipeline: BSON.Document[] = [
    { $match: { $or: changeKeys.map(k => ({ [k]: { $ne: null } })) } },
  ]
  for (const m of [hardMatch, match]) {
    if (m) {
      const q = $or(...changeKeys.map((k): Query<Change<V>> => subQ(m, root<Change<V>>().of(k))))
      if (q) pipeline.push({ $match: q.raw(root()) })
    }
  }
  pipeline.push({
    $project: {
      _id: 1,
      fullDocument: projection,
      fullDocumentBeforeChange: projection,
      documentKey: 1,
      clusterTime: 1,
    },
  })

  pipeline.push({
    $match: { $expr: { $ne: ['$fullDocument', '$fullDocumentBeforeChange'] } },
  })

  return db.collection(collection.collectionName).watch(pipeline, {
    fullDocument: 'required',
    fullDocumentBeforeChange: 'required',
    startAtOperationTime: startAt,
  })
}
