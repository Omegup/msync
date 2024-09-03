import type { BSON, Db, Timestamp } from 'mongodb'
import type { JsonObj, O, View, doc } from '../types'
import { sub } from './expression/logic'
import { root, type Field } from './field'
import { $or } from './query/logic'
import type { Query } from './types'

export const changeKeys = ['fullDocument', 'fullDocumentBeforeChange'] as const
export type ChangeKey = (typeof changeKeys)[number]

export type Change<T extends JsonObj> = O<{
  readonly fullDocument: T
  readonly fullDocumentBeforeChange: T
}>
export const subQ = <D extends JsonObj, C, DeltaD extends JsonObj>(
  a: Query<D, C>,
  f: Field<DeltaD, D>,
): Query<DeltaD, C> => ({ raw: g => a.raw(g.of(f)), expr: sub(a.expr, f) })

export const makeWatchStream = <T extends doc, V extends T & JsonObj = T>(
  db: Db,
  { collection, match, projection, hardMatch }: View<T, V>,
  startAt: Timestamp,
) => {
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
    $match: {$expr: {$ne: ['$fullDocument', '$fullDocumentBeforeChange']}}
  })

  return db.collection(collection.collectionName).watch(pipeline, {
    fullDocument: 'required',
    fullDocumentBeforeChange: 'required',
    startAtOperationTime: startAt,
  })
}
