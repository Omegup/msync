import type { ArrHKT, ConstHKT, IdHKT, rawItem } from '../../types'
import { operator } from './utils'

const dualIn = operator<
  '$in' | '$nin',
  ConstHKT<rawItem, ArrHKT<rawItem>>,
  rawItem,
  rawItem,
  ConstHKT<rawItem, IdHKT<rawItem>>
>()

export const $in = dualIn('$in')
export const $nin = dualIn('$nin')
