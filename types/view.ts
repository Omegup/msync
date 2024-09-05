import type { Db } from 'mongodb';
import type { Query } from '../lib/types';
import type { JsonObj } from './json';
import type { RawStage } from './mongo';

export type ReadonlyCollection<out T> = {
  [RawStage](_: 2): T
  readonly s: { readonly db: Db }
  collectionName: string
}

export type WriteonlyCollection<in R> = {
  insertOne(x: R): unknown
  readonly s: { readonly db: Db }
  collectionName: string
}

export type View<T extends JsonObj, V extends T & JsonObj = T> = {
  collection: ReadonlyCollection<V>
  projection: Record<string & keyof T, 1>
  match?: Query<T>
  hardMatch?: Query<V>
}
