import type { ArrHKT, ConstHKT, IdHKT } from '../../types'
import { operator } from './utils'

const dualIn = operator<
  '$in' | '$nin',
  ConstHKT<ArrHKT>,
  unknown,
  unknown,
  ConstHKT<IdHKT>
>()

export const $in = dualIn('$in')
export const $nin = dualIn('$nin')
