import type { O, RWCollection, ReadonlyCollection, Replace, jsonItem } from '../../types'
import type { ExprsExact } from '../expression/concat'
import { root, type Field } from '../field'
import type { RawStages } from '../types'
import { dbcoll } from '../utils/coll'
import { asStages } from './prefix'
import { rawVars } from './raws'

export type MergeInto<T extends O, Out extends O, E = unknown> =
  | { whenNotMatched: 'insert'; into: RWCollection<T, Out> & E }
  | { whenNotMatched: 'discard' | 'fail'; into: ReadonlyCollection<Out> & E }

// whenNotMatched == 'insert' || whenMatched == 'replace'  => Out extends T
// whenMatched == 'merge' => Out extends T | into: WriteonlyCollection<Out>
// whenMatched == 'merge' => Out extends T | into: WriteonlyCollection<Out>
export type MergeArgs<T extends O, Out extends O, Ctx, In extends O> = {
  on: Field<T, jsonItem> & Field<Out, jsonItem>
} & MergeInto<T, Out> &
  (
    | ({ stages?: never } & (
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
        into: RWCollection<In, Out>
        whenMatched: RawStages<unknown, Out, In, { new: T }>
      }
    | {
        stages: 'ctx'
        vars: ExprsExact<Ctx, T>
        into: RWCollection<In, Out>
        whenMatched: RawStages<unknown, Out, In, Ctx>
      }
  )

export const $merge_ = <T extends O, Out extends O = T, Ctx = unknown, In extends O = Out>({
  into,
  on,
  whenNotMatched,
  ...notMatched
}: MergeArgs<T, Out, Ctx, In>) =>
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
export const $merge2 = <T extends O, Out extends O = T, Ctx = unknown, In extends O = Out>(
  args: MergeArgs<T, Out, Ctx, In>,
) => $merge_<T, Out, Ctx, In>(args)
