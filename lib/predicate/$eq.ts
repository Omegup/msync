import { Timestamp } from 'mongodb'
import type { ConstHKT, IdHKT, RConstHKT } from '../../types'
import { operator } from './utils'

const dualEq = operator<'$eq' | '$ne', ConstHKT<unknown, IdHKT<unknown>>, unknown>()

export const $eq = dualEq('$eq')
export const $ne = dualEq('$ne')

type Numeric = number | Timestamp | Date
export const comp = operator<'$gt' | '$lt' | '$gte' | '$lte', RConstHKT<Numeric>, Numeric, number>()

export const $gt = comp('$gt')
export const $gtTs = comp<Timestamp>('$gt')
export const $gteTs = comp<Timestamp>('$gte')
export const $lt = comp('$lt')
export const dateLt = comp<Date>('$lt')
export const $gte = comp('$gte')
export const $lte = comp('$lte')
