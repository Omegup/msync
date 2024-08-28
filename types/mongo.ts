import 'mongodb'
import { BSON } from 'mongodb'

declare const RawStage: unique symbol
declare module 'mongodb' {
  export interface Collection<TSchema extends BSON.Document = BSON.Document> {
    [RawStage]?(x: TSchema): unknown
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
