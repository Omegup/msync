import type { Db, FindCursor } from 'mongodb'
import type { JsonObj } from './json'

export type ReadonlyCollection<out T> = {
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
}
