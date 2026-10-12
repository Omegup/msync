import type { Timestamp } from '../../types'

export type AggregateCommand<T> = {
  cursor: {
    id: number | { toString(): string }
    firstBatch: T[]
    atClusterTime: Timestamp
    ns: string
  }
}
