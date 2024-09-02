import type { ArrayHKT, ConstHKT, IdHKT } from '../../types'
import { operator } from './utils'

const dualIn = operator<
  '$in' | '$nin',
  ConstHKT<unknown, ArrayHKT>,
  unknown,
  unknown,
  ConstHKT<unknown, IdHKT>
>()

export const $in = dualIn('$in')
export const $nin = dualIn('$nin')
