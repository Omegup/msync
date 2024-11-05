import 'mongodb'
import { BSON } from 'mongodb'

export declare const RawStage: unique symbol
declare module 'mongodb' {
  export interface Collection<TSchema extends BSON.Document = BSON.Document> {
    [RawStage]:{
      (_: 1, x: TSchema): unknown
      (_: 2): TSchema
    }
    s: { db: Db }
  }
  export interface Db {
    s: { client?: MongoClient }
    client: MongoClient
  }
  export interface Timestamp {
    toExtendedJSON(): BSON.TimestampExtended
  }
}
export * from 'mongodb'
