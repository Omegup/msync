import type { AggregationCursor, Db, FindCursor } from 'mongodb'
import type { JsonObj } from './json'
import type { Document } from 'mongodb';
import type { Query } from '../lib/types';

export type ReadonlyCollection<out T> = {
  aggregate(pipeline?: Document[]): AggregationCursor<never>;
  find(): FindCursor<T>
  readonly s: { readonly db: Db }
  collectionName: string
}

export type WriteonlyCollection<in R> = {
  insertOne(x: R): unknown
  readonly s: { readonly db: Db }
  collectionName: string
}

export type View<T extends JsonObj> = {
  collection: ReadonlyCollection<T>
  projection: Record<keyof T, 1>
  match?: Query<T>
  hardMatch?: Query<T>
}
