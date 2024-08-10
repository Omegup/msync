import type { JsonObj } from './json'
import type { Query } from '../lib/types/query'
import type { Db } from 'mongodb'

export type ReadonlyCollection<out T> = {
  out?: T
  readonly s: { readonly db: Db }
  collectionName: string
}

export type View<T extends JsonObj> = {
  collection: ReadonlyCollection<T>
  match?: Query<T>
  projection: Record<keyof T, 1>
}
