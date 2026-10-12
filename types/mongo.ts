import type { PRRec } from './json'

export declare const RawStage: unique symbol

export type Document = object
export type Filter<T> = PRRec<keyof T & string, unknown> & Document
export type UpdateFilter<T> = { $set?: PRRec<keyof T & string, unknown> } & Document

export interface Timestamp {
  readonly _bsontype: 'Timestamp'
  readonly high: number
  readonly low: number
  comp(other: unknown): number
}

export interface UUID {
  toString(encoding: 'base64'): string
}

export interface Driver {
  Timestamp: {
    new (value: bigint): Timestamp
    new (value: { t: number; i: number }): Timestamp
  }
  UUID: new () => UUID
}

export interface Cursor<T> extends AsyncIterable<T> {
  next(): Promise<T | null>
  toArray(): Promise<T[]>
  close(): Promise<void>
}

export type IndexSpecification = Document
export type CreateIndexesOptions = Document & {
  name?: string
  partialFilterExpression?: Document
  unique?: boolean
}
export type UpdateOptions = { upsert?: boolean }

export interface Commander {
  command<T extends object = PRRec<string, unknown>>(command: Document): Promise<T>
}

export interface Client {
  db(name: string): Db
}

export interface Db extends Commander {
  readonly s: { readonly client?: Client }
  readonly client: Client
  readonly namespace: string
  admin(): Commander
  collection<T = Document>(name: string): Collection<T>
  createCollection(name: string): Promise<unknown>
  listCollections(filter: Document, options: { nameOnly: true }): Cursor<{ name: string }>
}

export interface Collection<TSchema = Document> {
  readonly s: { readonly db: Db }
  readonly collectionName: string
  readonly namespace: string
  readonly dbName: string
  [RawStage]: {
    (_: 2): TSchema
    (_: 1, x: TSchema): TSchema
  }
  createIndex(spec: IndexSpecification, options?: CreateIndexesOptions): Promise<string>
  findOne(filter: Document): Promise<TSchema | null>
  find(filter: Document, options?: Document): Cursor<TSchema>
  updateOne(
    filter: Document,
    update: Document | readonly Document[],
    options?: UpdateOptions,
  ): Promise<unknown>
  updateMany(filter: Document, update: Document | readonly Document[]): Promise<unknown>
  deleteOne(filter: Document): Promise<unknown>
  deleteMany(filter: Document): Promise<unknown>
  drop(): Promise<unknown>
}

export type WatchStream<T = {}> = {
  close(): Promise<void>
  tryNext(): Promise<T | null>
}
