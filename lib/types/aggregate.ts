import type { Long, Timestamp } from 'mongodb'

export type AggregateCommand<T> = {
  cursor: {
    id: Long | number
    firstBatch: T[]
    atClusterTime: Timestamp
    ns: string
  }
}
