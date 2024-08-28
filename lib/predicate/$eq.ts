import { Timestamp } from 'mongodb'
import type { IdHKT, Inner, jsonItem } from '../../types'
import type { Predicate, Query } from '../types'
import { id } from '../utils/json'
import { makeDualOperandPredicate } from './utils'

const dualEq = makeDualOperandPredicate<'$eq' | '$ne', IdHKT<jsonItem>>()

export const $eq = dualEq('$eq')
export const $ne = dualEq('$ne')

export const comp = makeDualOperandPredicate<
  '$gt' | '$lt' | '$gte' | '$lte',
  IdHKT<number | Timestamp>,
  number | Timestamp
>()

export const $gt = comp('$gt')
export const $gtTs = comp<Timestamp>('$gt')
export const $gteTs = comp<Timestamp>('$gte')
export const $lt = comp('$lt')
export const $gte = comp('$gte')
export const $lte = comp('$lte')

export const $elemMatch = <T extends jsonItem>(inner: Query<Inner<T>>): Predicate<T> => ({
  raw: { $elemMatch: inner.raw(id) },
})
