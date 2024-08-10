import 'mongodb'
import { BSON } from 'mongodb'

declare module 'mongodb' {
  export interface Collection {
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
