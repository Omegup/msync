import type { J, ReadonlyCollection } from '../../types'
import type { Expr, RawStages } from '../types'

export type LookupArgs<T extends J, U extends J, R, K extends string, Ctx, C> = {
  vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T, C> }
  k: K
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
