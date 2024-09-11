import type { ID, J, O, doc, notArr } from '../../types'
import { $lookupDelta } from '../aggregate/$lookup-delta'
import { $lookupRaw } from '../aggregate/$lookup-raw'
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
  Working,
} from '../types'
import { asBefore } from '../utils/before'
import { mergeItResults } from '../utils/merge'

type Next<L, R> = ({ source: 'L'; value: L } | { source: 'R'; value: R }) & Working

const merge = <Result, LD extends Working, RD extends Working>({
  lsource,
  rsource,
}: {
  lsource: IteratorResult<readonly Result[], LD>
  rsource: IteratorResult<readonly Result[], RD>
}): IteratorResult<readonly Result[], Next<LD, RD>> =>
  mergeItResults<'L' | 'R', Result, { L: LD; R: RD }>({
    L: lsource,
    R: rsource,
  })

const join = <T extends doc, U extends doc, S extends notArr, Result extends J, R, L>(
  { lField, rField, left, right }: Params<T, U, S>,
  leftSnapshot: TStages<L, Before<T>>,
  rightSnapshot: TStages<R, Before<U>>,
  stagesUntilNextLookup: DeltaStages<
    O<{ readonly left: T; readonly right: U; readonly _id: string }>,
    Result
  >,
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
    run: <Final extends J>(
      finalInput: RawStages<Delta<Result>, Final>,
    ): Runner<readonly Final[], Working> => {
      const leftJoinField = { field1: rField, field2: lField }
      const joinL_Delta = $lookupDelta(leftJoinField, leftSnapshot, 'right', 'left')
      const joinR_Delta = $lookupDelta(rightJoinField, rightSnapshot, 'left', 'right')
      const lRunnerInput = concatStages(joinR_Delta, stagesUntilNextLookup.delta)
      const rRunnerInput = concatStages(joinL_Delta, stagesUntilNextLookup.delta)
      const lRunner = left.run(concatStages(lRunnerInput, finalInput))
      const rRunner = right.run(concatStages(rRunnerInput, finalInput))

      return () => merge({ lsource: lRunner(), rsource: rRunner() })
    },
  }
}

type Params1<T extends J, U extends J, S extends notArr> = {
  lField: Field<T, S>
  rField: Field<U, S>
  right: SnapshotStreamExecutionResult<U>
}
type Params<T extends J, U extends J, S extends notArr> = Params1<T, U, S> & {
  left: SnapshotStreamExecutionResult<T>
}

export type LeftWrite<T, V> = O<{ readonly left: T; readonly right: V } & ID>

export const $lookup1 =
  <T extends doc, U extends doc, S extends notArr>(
    p: Params<T, U, S>,
  ): SnapshotStream<LeftWrite<T, U>> =>
  <Result extends J>(input: DeltaStages<LeftWrite<T, U>, Result>) =>
    p.left.stages(lStages => p.right.stages(rStages => join(p, lStages, rStages, input)))
export const $lookup =
  <T extends doc, U extends doc, S extends notArr>(p: Params1<T, U, S>) =>
  (l: SnapshotStream<T>): SnapshotStream<LeftWrite<T, U>> =>
    $lookup1({ ...p, left: l(emptyDelta()) })
