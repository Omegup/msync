import type { ArrHKT, ConstHKT, IdHKT } from '../../types'
import { operator } from './utils'

const dualIn = operator<
  '$in' | '$nin',
  ConstHKT<unknown, ArrHKT>,
  unknown,
  unknown,
  ConstHKT<unknown, IdHKT>
>()

export const $in = dualIn('$in')
export const $nin = dualIn('$nin')
