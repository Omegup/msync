import { Collection, type Timestamp } from 'mongodb'
import type { BSON, OPickD, rawItem, RawObj, StrKey } from '../../types'
import type { Actions, Model } from '../types/stream'

export type AllowedPick<V extends Model, K extends StrKey<V>> = OPickD<V, Allowed<K>>
export type Allowed<K> = Exclude<K, 'deletedAt' | '_id'>
export type Teardown = { collection: string; method: string; params: unknown[] }
export type TsData = {
  input: readonly RawObj[]
  finalInput: readonly RawObj[]
  finalInputFirst: readonly RawObj[]
  project: rawItem
  match: rawItem
  teardown: Teardown
}
export type Last = {
  _id: string
  ts: Timestamp
  data?: TsData
}

export const actions: {
  [K in keyof Actions<unknown>]: <W extends BSON.Document>(
    col: Collection<W>,
    x: Actions<W>[K],
  ) => [Promise<unknown>, unknown[]]
} = {
  updateMany: (c, args) => [
    c.updateMany(...args),
    [`db['${c.collectionName}'].updateMany(...`, args, ')'],
  ],
  deleteMany: (c, args) => [
    c.deleteMany(...args),
    [`db['${c.collectionName}'].deleteMany(...`, args, ')'],
  ],
}

