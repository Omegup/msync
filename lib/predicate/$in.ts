import type { ArrHKT, jsonItem } from '../../types'
import { makeDualOperandPredicate } from './utils'

const dualIn = makeDualOperandPredicate<'$in' | '$nin', ArrHKT<jsonItem>>()

export const $in = dualIn('$in')
export const $nin = dualIn('$nin')
