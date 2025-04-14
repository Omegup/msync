import type { BSON, Db, Timestamp } from 'mongodb'
import type { O, StrKey, View } from '../types'
import { root, type Field } from './field'
import { $or } from './query/logic'
import type { Model, Query } from './types'
import { mapExactToObject } from './utils/map-object'
import { log } from './utils'

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
  streamName: string,
) => {
  const projection = { ...mapExactToObject(p, v => v), deletedAt: 1 }
  const pipeline: BSON.Document[] = []
  if (m) {
    const q = $or(...changeKeys.map((k): Query<Change<V>> => subQ(m, root<Change<V>>().of(k))))
    if (q)
      pipeline.push({
        $match: {
          $or: [
            q.raw(root()),
            // recheck whenever a document with lost value is deleted
            Object.fromEntries(changeKeys.map(k => [k, null])),
          ],
        },
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
    $replaceWith: {
      ts: {
        $cond: {
          if: {
            $or: [
              { $ne: ['$fullDocument', '$fullDocumentBeforeChange'] },
              { $and: changeKeys.map(k => ({ $eq: [k, null] })) },
            ],
          },
          then: '$clusterTime',
          else: null,
        },
      },
    },
  })
  const stream = db.collection(collection.collectionName).watch<BSON.Document, { ts: Timestamp | null }>(pipeline, {
    fullDocument: 'required',
    fullDocumentBeforeChange: 'required',
    startAtOperationTime: startAt,
  })

  const tryNext = async () => {
    const doc = await stream.tryNext()
    // wait a bit for bulk operations so we run the stream for once
    if (doc) await new Promise(resolve => setTimeout(resolve, 100))
    if (doc) log('detected', streamName, collection.collectionName, doc)
    return doc
  }
  return { tryNext, close: () => stream.close() }
}
