import type { JsonObj } from '../../types'
import { $match_ } from '../aggregate/$match-raw'
import { fromStages } from '../aggregate/prefix'
import type { Query } from '../types'

export const $match = <T extends JsonObj>(q: Query<T>) => fromStages($match_(q))
