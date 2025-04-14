import { Timestamp } from 'mongodb'
import type { ArrHKT, ConstHKT, HKT, I, IdHKT, N, rawItem, RawObj, RConstHKT } from '../../types'
import { operator } from './utils'

const dualEq = operator<'$eq' | '$ne', ConstHKT<IdHKT<unknown>>, unknown>()

export const $eq = dualEq('$eq')
export const $ne = dualEq('$ne')

type Numeric = number | Timestamp | Date
export const comp = operator<'$gt' | '$lt' | '$gte' | '$lte', RConstHKT<Numeric>, Numeric, Numeric>()

export const $gt = comp<Numeric>('$gt')
export const $gtTs = comp<Timestamp>('$gt')
export const $gteTs = comp<Timestamp>('$gte')
export const $lt = comp<number>('$lt')
export const dateLt = comp<Date>('$lt')
export const $gte = comp<number>('$gte')
export const $lte = comp<number>('$lte')

interface DictHKT<T> extends HKT<keyof T, unknown> {
  readonly out: T[I<keyof T, this>] | N
}

declare const unknown: unique symbol
type MongoTypes = {
  number: number,
  array: readonly rawItem[],
  string: string,
  object: RawObj,
  [i: number]: unknown
}

export type MongoTypeNames = keyof MongoTypes

export const $type = operator<'$type', ConstHKT<ArrHKT<keyof MongoTypes>>, keyof MongoTypes, unknown, ConstHKT<DictHKT<MongoTypes>> >()('$type')
export const $exists = operator<'$exists', ConstHKT<ConstHKT<boolean>>, keyof MongoTypes, unknown, ConstHKT<ConstHKT<unknown>> >()('$exists')

