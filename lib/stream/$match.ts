import type { J } from '../../types'
import { $match_ } from '../aggregate/mongo-stages'
import { fromStages } from '../aggregate/prefix'
import type { Query } from '../types'

export const $match = <T extends J>(q: Query<T>) => fromStages($match_(q))
