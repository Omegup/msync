import type { BSON, Db, Timestamp } from 'mongodb'
import type { O, StrKey, View } from '../types'
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
): Query<DeltaD, C> => ({ raw: g => a.raw(g.with(f)) })

export const makeWatchStream = <V extends Model, K extends StrKey<V>>(
  db: Db,
  { collection, projection: p, hardMatch: m }: View<V, K>,
  startAt: Timestamp,
) => {
  const projection = mapExactToObject(p, v => v)
  const pipeline: BSON.Document[] = []
  if (m) {
    const q = $or(...changeKeys.map((k): Query<Change<V>> => subQ(m, root<Change<V>>().of(k))))
    if (q)
      pipeline.push({
        $match: { $or: [q.raw(root()), Object.fromEntries(changeKeys.map(k => [k, null]))] },
      })
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
    $match: {
      $or: [
        { $expr: { $ne: ['$fullDocument', '$fullDocumentBeforeChange'] } },
        Object.fromEntries(changeKeys.map(k => [k, null])),
      ],
    },
  })

  // log('pipeline', collection.collectionName, pipeline, {
  //   fullDocument: 'required',
  //   fullDocumentBeforeChange: 'required',
  //   startAtOperationTime: startAt,
  // })

  const stream = db.collection(collection.collectionName).watch(pipeline, {
    fullDocument: 'required',
    fullDocumentBeforeChange: 'required',
    startAtOperationTime: startAt,
  })
  const tryNext = async () => {
    const doc = await stream.tryNext()
    // console.log('doc', startAt, collection.collectionName, doc)
    if (doc) await new Promise(resolve => setTimeout(resolve, 100))
    return doc
  }
  return { tryNext, close: () => stream.close() }
}
