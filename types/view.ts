import type { Collection, Db } from 'mongodb'
import type { Del, Expr, Model, Query } from '../lib/types'
import type { ExactKeys } from '../lib/utils/map-object'
import type { O, StrKey } from './json'
import type { RawStage } from './mongo'

interface CommonCollection {
  readonly s: { readonly db: Db }
  collectionName: string
  namespace: string
  dbName: string
  createIndex: Collection['createIndex']
}

export interface ReadonlyCollection<out T> extends CommonCollection {
  [RawStage](_: 2): T
}

export interface WriteonlyCollection<in R> extends CommonCollection {
  [RawStage]: { (_: 1, x: R): unknown }
}

// RWCollection<A, A | B | C> accepts Collection<A | B>
export interface RWCollection<in T extends O, out Out extends O = T> extends CommonCollection {
  [RawStage](_: 2): Out
  [RawStage](_: 1, x: T): Out
}

export type OPick<V, K extends StrKey<V>, E extends StrKey<V> = never> = O & Pick<V, K | E>
export type OPickD<V extends Model, K extends StrKey<V>> = OPick<V, K, 'deletedAt' | '_id'>

export type View<V extends Model, K extends StrKey<V>> = {
  collection: ReadonlyCollection<V | Del>
  projection: ExactKeys<K>
  match?: Expr<boolean, OPickD<V, K>>
  hardMatch?: Query<V>
}
