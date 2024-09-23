import type { ID, J, O, doc, notArr } from '../../types'
import { $lookupDelta, $lookupRaw } from '../aggregate/lookup'
import { concatStages, concatTStages, emptyDelta } from '../aggregate/prefix'
import type { Field } from '../field'
import type {
  Before,
  Delta,
  DeltaStages,
  IteratorResult,
  RawStages,
  Runner,
  SnapshotStream,
  SnapshotStreamExecutionResult,
  TStages,
  HasJob,
} from '../types'
import { asBefore } from '../utils/before'
import { mergeIterators } from '../utils/merge'

type Next<L, R> = ({ key: 'L'; value: L } | { key: 'R'; value: R }) & HasJob

const merge = <Result, LD extends HasJob, RD extends HasJob>({
  lsource: L,
  rsource: R,
}: {
  lsource: IteratorResult<readonly Result[], LD>
  rsource: IteratorResult<readonly Result[], RD>
}): IteratorResult<readonly Result[], Next<LD, RD>> =>
  mergeIterators<'L' | 'R', readonly Result[], { L: LD; R: RD }>({ sources: { L, R } })

const join = <
  As extends string,
  QT extends J,
  T extends QT,
  L,
  BL extends Before<QT>,
  QU extends J,
  U extends QU,
  S extends notArr,
  R,
  BR extends Before<QU>,
  Result extends LeftRight<QT, QU>
>(
  { lField, rField, left, right, as }: Params<As, QT, T, QU, U, S>,
  leftSnapshot: TStages<L, Before<QT>, BL, Before<T>>,
  rightSnapshot: TStages<R, Before<QU>, BR, Before<U>>,
  stagesUntilNextLookup: DeltaStages<LeftRight<QT, QU>, LeftRight<T, U>, Result>,
): SnapshotStreamExecutionResult<Result> => {
  const rightJoinField = { field1: lField, field2: rField }
  const joinR_Snapshot = $lookupRaw(rightJoinField, rightSnapshot, 'left', 'right', {
    left: 'a',
    right: 'b',
  })
  const resultingSnapshot = concatTStages(leftSnapshot, asBefore(joinR_Snapshot))
  return {
    stages: consume =>
      consume(concatTStages(resultingSnapshot, asBefore(stagesUntilNextLookup.raw))),
    out: <Final>(finalInput: RawStages<Delta<Result>, Final>): Runner<readonly Final[], HasJob> => {
      const leftJoinField = { field1: rField, field2: lField }
      const joinL_Delta = $lookupDelta(leftJoinField, leftSnapshot, 'right', 'left')
      const joinR_Delta = $lookupDelta(rightJoinField, rightSnapshot, 'left', 'right')
      const lRunnerInput = concatStages(joinR_Delta, stagesUntilNextLookup.delta)
      const rRunnerInput = concatStages(joinL_Delta, stagesUntilNextLookup.delta)
      const lRunner = left.out(concatStages(lRunnerInput, finalInput))
      const rRunner = right.out(concatStages(rRunnerInput, finalInput))

      return () => merge({ lsource: lRunner(), rsource: rRunner() })
    },
  }
}

type Params1<As extends string, QT extends J, QU extends J, U extends QU, S extends notArr> = {
  lField: Field<QT, S>
  rField: Field<QU, S>
  right: SnapshotStreamExecutionResult<QU, U>
  as: As
}
type Params<
  As extends string,
  QT extends J,
  T extends QT,
  QU extends J,
  U extends QU,
  S extends notArr,
> = Params1<As, QT, QU, U, S> & {
  left: SnapshotStreamExecutionResult<QT, T>
}

export type LeftRight<T, V> = O<{ readonly left: T; readonly right: V } & ID>

export const $lookup1 =
  <As extends string, QT extends J, T extends QT, QU extends J, U extends QU, S extends notArr>(
    p: Params<As, QT, T, QU, U, S>,
  ): SnapshotStream<LeftRight<QT, QU>, LeftRight<T, U>> =>
  <Result extends LeftRight<QT, QU>>(
    input: DeltaStages<LeftRight<QT, QU>, LeftRight<T, U>, Result>,
  ) =>
    p.left.stages(lStages => p.right.stages(rStages => join(p, lStages, rStages, input)))
export const $lookup =
  <As extends string, QT extends J, QU extends J, U extends QU, S extends notArr>(
    p: Params1<As, QT, QU, U, S>,
  ) =>
  <T extends QT>(l: SnapshotStream<QT, T>): SnapshotStream<LeftRight<QT, QU>, LeftRight<T, U>> =>
    $lookup1({ ...p, left: l(emptyDelta()) })
