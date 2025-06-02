import type { O, O2, StrKey, View } from '../../types'
import type { HKT, I, IdHKT } from '../../types/hkt'
import { concatDelta, emptyDelta, link, pipe, type DeltaPipe } from '../aggregate/prefix'
import { root } from '../field'
import type { Del, DeltaStages, Model, RawStages, Stages } from '../types/stream'
import type { DeltaHKT } from './boot'
import type { Allowed, AllowedPick } from './boot-utils'
import { getFirstStages } from './first-stages'

export type SingleResult<out Result> = <Result2>(
  finalInput: RawStages<unknown, Result, Result2>,
) => Stages<unknown, Result2, unknown>

export interface SnapshotStreamHKT2 extends HKT<O2> {
  readonly out: SingleResult<I<O2, this>[1]>
}

const executes = <
  q extends O,
  V extends Model,
  KK extends StrKey<V>,
  Result extends q | AllowedPick<V, KK>,
>(
  view: View<V, Allowed<KK>>,
  input: DeltaStages<q | AllowedPick<V, KK>, AllowedPick<V, KK>, Result>,
): SingleResult<Result> => {
  type T = AllowedPick<V, KK>
  const { firstStages } = getFirstStages(view)
  const { collection } = view
  return <Result2>(
    finalInput: RawStages<unknown, Result, Result2>,
  ): Stages<unknown, Result2, unknown> => {
    const start: RawStages<O, T, Result> = input.raw<IdHKT<O>>(root)
    const stages = firstStages(null, true).with(start).with(finalInput).stages
    return c =>
      c<Del | V, Del | V>({
        coll: collection,
        input: link<V | Del>().stages,
        exec: stages,
      })
  }
}

export const single = <V extends Model, KK extends StrKey<V>>(
  view: View<V, Allowed<KK>>,
): DeltaPipe<AllowedPick<V, KK>, AllowedPick<V, KK>, SnapshotStreamHKT2, DeltaHKT> =>
  pipe<AllowedPick<V, KK>, AllowedPick<V, KK>, AllowedPick<V, KK>, SnapshotStreamHKT2, DeltaHKT>(
    input => executes(view, input),
    emptyDelta(),
    concatDelta,
    emptyDelta,
  )
