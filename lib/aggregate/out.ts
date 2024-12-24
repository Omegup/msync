import type { O, RWCollection, Replace, jsonItem } from '../../types'
import type { ExprsExact } from '../expression/concat'
import { root, type Field } from '../field'
import type { RawStages } from '../types'
import { dbcoll } from '../utils/coll'
import { asStages } from './prefix'
import { rawVars } from './raws'

export type MergeInto<T extends O, Out extends O> =
  | { whenNotMatched: 'insert'; into: RWCollection<T, Out> }
  | { whenNotMatched: 'discard' | 'fail'; into: RWCollection<Out> }

// whenNotMatched == 'insert' || whenMatched == 'replace'  => Out extends T
// whenMatched == 'merge' => Out extends T | into: WriteonlyCollection<Out>
// whenMatched == 'merge' => Out extends T | into: WriteonlyCollection<Out>
export type MergeArgs<T extends O, Out extends O, Ctx> = {
  on: Field<T, jsonItem>
} & MergeInto<T, Out> &
  (
    | ({ stages?: undefined } & (
        | { whenMatched: 'keepExisting' | 'fail' }
        | {
            whenMatched: 'replace'
            into: RWCollection<T, Out>
          }
        | {
            whenMatched: 'merge'
            into: RWCollection<Replace<Out, T>, Out>
          }
      ))
    | {
        stages: true
        whenMatched: RawStages<unknown, Out, Out>
      }
    | {
        stages: 'ctx'
        vars: ExprsExact<Ctx, T>
        whenMatched: RawStages<unknown, Out, Out, Ctx>
      }
  )

export const $merge_ = <T extends O, Out extends O = T, Ctx = unknown>({
  into,
  on,
  whenNotMatched,
  ...notMatched
}: MergeArgs<T, Out, Ctx>) =>
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
