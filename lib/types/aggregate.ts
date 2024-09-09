import type { Long, Timestamp } from 'mongodb'
import type { J } from '../../types'

export type AggregateCommand<T extends J> = {
  cursor: {
    id: Long | number
    firstBatch: T[]
    atClusterTime: Timestamp
    ns: string
  }
}
