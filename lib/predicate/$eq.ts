import { Timestamp } from 'mongodb'
import { Predicate, Query } from '../types'
import { IdHKT } from '../types/hkt'
import { Inner, jsonItem } from '../types/json'
import { id } from '../utils/json'
import { equal, makeDualOperandPredicate, negative, positive } from './utils'

const dualEq = makeDualOperandPredicate<'$eq' | '$ne', IdHKT<jsonItem>>(a => x => equal(a, x))

export const $eq = dualEq('$eq', positive)
export const $ne = dualEq('$ne', negative)

export const comp =
  <T extends jsonItem = number>(key: '$gt' | '$lt' | '$gte' | '$lte', op: (x: T, y: T) => boolean) =>
  (value: T): Predicate<T | null> => ({
    raw: { [key]: value },
    deepTest: accessor => accessor(x => x != null && op(x, value), true),
  })

export const $gt = comp('$gt', (a, b) => a > b)
export const $gtTs = comp<Timestamp>('$gt', (a, b) => a.compare(b) > 0)
export const $gteTs = comp<Timestamp>('$gte', (a, b) => a.compare(b) >= 0)
export const $lt = comp('$lt', (a, b) => a < b)
export const $gte = comp('$gte', (a, b) => a >= b)
export const $lte = comp('$lte', (a, b) => a <= b)

export const $exists = <T extends jsonItem>(): Predicate<T> => ({
  raw: { $exists: 1 },
  deepTest: accessor => accessor(part => part !== undefined, true),
})

export const tsLt = (value: Timestamp): Predicate<Timestamp> => ({
  raw: { $lt: value },
  deepTest: accessor => accessor(x => x.lt(value), true),
})

export const $size = <T>($size: number): Predicate<T[]> => ({
  raw: { $size },
  deepTest: accessor => accessor(part => Array.isArray(part) && part.length === $size, false),
})

export const $elemMatch = <T extends jsonItem>(inner: Query<Inner<T>>): Predicate<T> => ({
  raw: { $elemMatch: inner.raw(id) },
  deepTest: accessor => accessor(part => Array.isArray(part) && part.some(inner.test), false),
})
