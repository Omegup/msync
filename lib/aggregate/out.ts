import type { J, WriteonlyCollection, jsonItem } from '../../types'
import { root, type Field } from '../field'
import type { Expr, RawStages } from '../types'
import { dbcoll } from '../utils/coll'
import { asStages } from './prefix'
import { rawVars } from './raws'

export const $merge_ = <T extends J, Out extends T = T, Ctx = unknown>({
  into,
  on,
  whenNotMatched,
  ...notMatched
}: {
  into: WriteonlyCollection<Out>
  on: Field<T, jsonItem>
  whenNotMatched?: 'insert' | 'discard' | 'fail'
} & ({ into: WriteonlyCollection<T> } | { whenNotMatched: 'discard' | 'fail' }) &
  (
    | { stages?: undefined; whenMatched?: 'replace' | 'keepExisting' | 'merge' | 'fail' }
    | {
        stages: true
        whenMatched: RawStages<unknown, T, Out>
      }
    | {
        stages: 'ctx'
        vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T> }
        whenMatched: RawStages<unknown, T, Out, Ctx>
      }
  )) =>
  asStages<unknown, T, 'out'>([
    {
      $merge: {
        into: dbcoll(into),
        on: on.str(),
        ...(whenNotMatched && { whenNotMatched }),
        ...(notMatched.stages && {
          whenMatched: notMatched.whenMatched,
          ...(notMatched.stages === 'ctx' && { let: rawVars(notMatched.vars, root<T>()) }),
        }),
      },
    },
  ])
