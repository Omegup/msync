import 'mongodb'
import { Timestamp, UUID } from 'mongodb'
import type { BSON } from 'mongodb'
import type { Driver, RawStage } from '../types'
import { useDriver } from '../lib/driver'

declare module 'mongodb' {
  export interface Collection<TSchema extends BSON.Document = BSON.Document> {
    [RawStage]: {
      (_: 2): TSchema
      (_: 1, x: TSchema): TSchema
    }
    s: { db: Db }
  }
  export interface Db {
    s: { client?: MongoClient }
    client: MongoClient
  }
}

export const mongodbDriver: Driver = { Timestamp, UUID }
export const useMongoDB = () => useDriver(mongodbDriver)
