import type { AsLiteral, O, ReadonlyCollection } from '../../types'
import type { ExprsExact } from '../expression/concat'
import type { RawStages } from '../types'

export type LookupArgs<T extends O, U extends O, R, K extends string, Ctx, C> = {
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
