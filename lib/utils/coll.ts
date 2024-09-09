import type { ReadonlyCollection, WriteonlyCollection } from '../../types'

export const dbcoll = (x: ReadonlyCollection<unknown> | WriteonlyCollection<never>) => ({
  db: x.dbName,
  coll: x.collectionName,
})
