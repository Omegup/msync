import type { AsLiteral, J, ReadonlyCollection } from '../../types'
import type { ExprsExact } from '../expression/concat'
import type { RawStages } from '../types'

export type LookupArgs<T extends J, U extends J, R, K extends string, Ctx, C> = {
  vars: ExprsExact<Ctx, T, C>
  k: AsLiteral<K>
} & (
  | {
      coll: ReadonlyCollection<R>
      pipeline: RawStages<unknown, R, U, Ctx & C>
    }
  | {
      coll?: undefined
      pipeline: RawStages<unknown, null, U, Ctx & C>
    }
)
