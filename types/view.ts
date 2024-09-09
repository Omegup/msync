import type { Db } from 'mongodb'
import type { Query } from '../lib/types'
import type { J, StrKey } from './json'
import type { RawStage } from './mongo'

interface CommonCollection {
  readonly s: { readonly db: Db }
  collectionName: string
  namespace: string
  dbName: string
}

export interface ReadonlyCollection<out T> extends CommonCollection {
  [RawStage](_: 2): T
}

export interface WriteonlyCollection<in R> extends CommonCollection {
  insertOne(x: R): unknown
}

export type View<T extends J, V extends T & J = T> = {
  collection: ReadonlyCollection<V>
  projection: Record<StrKey<T>, 1>
  match?: Query<T>
  hardMatch?: Query<V>
}
