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
  const projection = p ? { ...mapExactToObject(p, v => v), deletedAt: 1 } : 1
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
    $match: {
      clusterTime: { $gt: startAt },
      $or: [
        {
          $expr: {
            $ne: [
              { $mergeObjects: ['$fullDocument', { touchedAt: null }] },
              { $mergeObjects: ['$fullDocumentBeforeChange', { touchedAt: null }] },
            ],
          },
        },
        Object.fromEntries(changeKeys.map(k => [k, null])),
      ],
    },
  })
  pipeline.push({
    $project: {
      _id: 1,
    },
  })

  const stream = db.collection(collection.collectionName).watch(pipeline, {
    fullDocument: 'required',
    fullDocumentBeforeChange: 'required',
    startAtOperationTime: startAt,
  })
  log('watch stream created', streamName, collection.collectionName, 'startAt', startAt, pipeline)
  const tryNext = async () => {
    const doc = await stream.tryNext().then(
      doc => doc,
      err => ({ err }),
    )
    if (doc) {
      // await stream.close().catch(() => {})
      // wait a bit for bulk operations so we run the stream for once
      await new Promise(resolve => setTimeout(resolve, 100))
      log('detected', streamName, collection.collectionName, doc)
    }
    return doc
  }
  return { tryNext, close: () => stream.close() }
}
