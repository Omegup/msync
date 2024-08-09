import type { Long, Timestamp } from 'mongodb'
import type { JsonObj } from '../../types'

export type AggregateCommand<T extends JsonObj> = {
  cursor: {
    id: Long | number
    firstBatch: T[]
    atClusterTime: Timestamp
    ns: string
  }
}
