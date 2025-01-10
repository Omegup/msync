import type { AsLiteral, O, ReadonlyCollection } from '../../types'
import type { ExprsExact } from '../expression/concat'
import type { Field } from '../field'
import type { RawStages } from '../types'

export type LookupArgs<T extends O, U extends O, R, K extends string, Ctx, C, s = string> = {
  vars: ExprsExact<Ctx, T, C>
  k: AsLiteral<K>
} & (
  | {
      coll: ReadonlyCollection<R>
      pipeline: RawStages<unknown, R, U, Ctx & C>
      fields?: { foreign: Field<R, s>; local: Field<T, s> }
    }
  | {
      coll?: never
      pipeline: RawStages<unknown, null, U, Ctx & C>
      fields?: never
    }
)
