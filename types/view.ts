import type { Db } from 'mongodb'
import type { JsonObj } from './json'

export type ReadonlyCollection<out T> = {
  out?: T
  readonly s: { readonly db: Db }
  collectionName: string
}

export type WriteonlyCollection<in R> = {
  in?: (x: R) => void
  readonly s: { readonly db: Db }
  collectionName: string
}

export type View<T extends JsonObj> = {
  collection: ReadonlyCollection<T>
  projection: Record<keyof T, 1>
}
