import type { JsonObj, O, notArr } from '../../types'
import { $lookupDelta } from '../aggregate/$lookup-delta'
import { $lookupRaw } from '../aggregate/$lookup-raw'
import { concatStages, concatTStages } from '../aggregate/prefix'
import type { Field } from '../field'
import type {
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
import { mergeItResults } from '../utils/merge'

type Next<L, R> = ({ source: 'L'; value: L } | { source: 'R'; value: R }) & Working

const merge = <L extends LD, R extends RD, Result, LD extends Working, RD extends Working>({
  lsource,
  rsource,
}: {
  lsource: IteratorResult<readonly Result[], L, LD>
  rsource: IteratorResult<readonly Result[], R, RD>
}): IteratorResult<readonly Result[], Next<L, R>, Next<LD, RD>> =>
  mergeItResults<'L' | 'R', { L: L; R: R }, Result, { L: LD; R: RD }>(
    {
      L: lsource,
      R: rsource,
    },
    x => x.work,
  )

const join = <T extends JsonObj, U extends JsonObj, S extends notArr, Result extends JsonObj, R, L>(
  { lField, rField, left, right }: Params<T, U, S>,
  leftSnapshot: TStages<L, T>,
  rightSnapshot: TStages<R, U>,
  stagesUntilNextLookup: DeltaStages<O<{ readonly left: T; readonly right: U }>, Result>,
): SnapshotStreamExecutionResult<Result> => {
  const rightJoinField = { field1: lField, field2: rField }
  const joinR_Snapshot = $lookupRaw(rightJoinField, rightSnapshot, 'left', 'right')
  const resultingSnapshot = concatTStages(leftSnapshot, joinR_Snapshot)
  return {
    stages: consume => consume(concatTStages(resultingSnapshot, stagesUntilNextLookup.raw)),
    run: <Final extends JsonObj>(
      finalInput: RawStages<Delta<Result>, Final>,
    ): Runner<readonly Final[], Working> => {
      const leftJoinField = { field1: rField, field2: lField }
      const joinL_Delta = $lookupDelta(leftJoinField, leftSnapshot, 'right', 'left')
      const joinR_Delta = $lookupDelta(rightJoinField, rightSnapshot, 'left', 'right')
      const lRunnerInput = concatStages(joinR_Delta, stagesUntilNextLookup.delta)
      const rRunnerInput = concatStages(joinL_Delta, stagesUntilNextLookup.delta)
      const lRunner = left.run(concatStages(lRunnerInput, finalInput))
      const rRunner = right.run(concatStages(rRunnerInput, finalInput))
      return consume => lRunner(lsource => rRunner(rsource => consume(merge({ lsource, rsource }))))
    },
  }
}

type Params<T extends JsonObj, U extends JsonObj, S extends notArr> = {
  lField: Field<T, S>
  rField: Field<U, S>
  left: SnapshotStreamExecutionResult<T>
  right: SnapshotStreamExecutionResult<U>
}
export const $lookup =
  <T extends JsonObj, U extends JsonObj, S extends notArr>(
    p: Params<T, U, S>,
  ): SnapshotStream<O<{ left: T; right: U }>> =>
  <Result extends JsonObj>(input: DeltaStages<O<{ left: T; right: U }>, Result>) =>
    p.left.stages(lStages => p.right.stages(rStages => join(p, lStages, rStages, input)))
