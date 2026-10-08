import type { RawObj, ReadonlyCollection, WriteonlyCollection } from '../../types'
import { safeNarrow } from './json';

export const dbcoll = (x: ReadonlyCollection<unknown> | WriteonlyCollection<never>) => safeNarrow<RawObj>()({
  db: x.dbName,
  coll: x.collectionName,
})
