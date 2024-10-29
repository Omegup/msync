import type { Db } from 'mongodb'
import type { Del, Query } from '../lib/types'
import type { J, O, RemoveSignature, StrKey } from './json'
import type { RawStage } from './mongo'
import type { ExactKeys } from '../lib/utils/map-object'

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
  insertOne(x: Omit<R, keyof O>): unknown
}

export type View<T extends J, V extends T & J = T> = {
  collection: ReadonlyCollection<V | Del>
  projection: ExactKeys<StrKey<RemoveSignature<T>>>
  match?: Query<T>
  hardMatch?: Query<V>
}
