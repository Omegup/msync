import type { Collection, Db } from 'mongodb'
import type { Del, Model, Query } from '../lib/types'
import type { ExactKeys, MapKDom } from '../lib/utils/map-object'
import type { ConstHKT, HKT } from './hkt'
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
  insertOne(x: Omit<R, keyof O>): unknown
}

export type KDom<
  RK extends KDom<RK, K, F>,
  K extends string,
  F extends HKT<K> = ConstHKT<1>,
> = MapKDom<RK, F, K>

export type OPick<V, K extends StrKey<V>, E extends StrKey<V> = never> = O & Pick<V, K | E>
export type OPickD<V extends Model, K extends StrKey<V>> = OPick<V, K, 'deletedAt' | '_id'>

export type View<V extends Model, K extends StrKey<V>> = {
  collection: ReadonlyCollection<V | Del>
  projection: ExactKeys<K>
  match?: Query<OPickD<V, K>>
  hardMatch?: Query<V>
}
