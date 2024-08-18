import type { JsonObj } from '../../types'
import { $matchRaw } from '../aggregate/$match-raw'
import { fromStages } from '../aggregate/prefix'
import type { Query } from '../types'

export const $match = <T extends JsonObj>(q: Query<T>) => fromStages($matchRaw(q))
