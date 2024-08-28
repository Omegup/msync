import type { JsonObj } from '../../types'
import { $lookupRaw } from '../aggregate/$match-raw'
import { concatParts, concatStages } from '../aggregate/prefix'
import type { Field } from '../field'
import type {
  SnapshotStreamExecutionResult,
  IteratorResult,
  RawStagesPart,
  RawStagesSource,
  Runner,
  SnapshotStream,
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

const join = <T extends JsonObj, U extends JsonObj, S, Result extends JsonObj, R, L>(
  { lField, rField, left, right }: Params<T, U, S>,
  leftSnapshot: RawStagesSource<L, T>,
  rightSnapshot: RawStagesSource<R, U>,
  stagesUntilNextLookup: RawStagesPart<{ left: T; right: U }, Result>,
): SnapshotStreamExecutionResult<Result> => {
  const rightJoinField = { field1: lField, field2: rField }
  const joinR_Snapshot = $lookupRaw(rightJoinField, rightSnapshot, 'left', 'right')
  const resultingSnapshot = concatStages(leftSnapshot, joinR_Snapshot)
  return {
    stages: consume => consume(concatStages(resultingSnapshot, stagesUntilNextLookup)),
    run: <Final extends JsonObj>(
      finalInput: RawStagesPart<Result, Final>,
    ): Runner<readonly Final[], Working> => {
      const leftJoinField = { field1: rField, field2: lField }
      const joinL_Snapshot = $lookupRaw(leftJoinField, leftSnapshot, 'right', 'left')
      const lRunnerInput = concatParts(joinR_Snapshot, stagesUntilNextLookup)
      const rRunnerInput = concatParts(joinL_Snapshot, stagesUntilNextLookup)
      const lRunner = left.run(concatParts(lRunnerInput, finalInput))
      const rRunner = right.run(concatParts(rRunnerInput, finalInput))
      return consume => lRunner(lsource => rRunner(rsource => consume(merge({ lsource, rsource }))))
    },
  }
}

type Params<T extends JsonObj, U extends JsonObj, S> = {
  lField: Field<T, S> | Field<T, Arr<S>>
  rField: Field<U, S> | Field<U, Arr<S>>
  left: SnapshotStreamExecutionResult<T>
  right: SnapshotStreamExecutionResult<U>
}
export const $lookup =
  <T extends JsonObj, U extends JsonObj, S>(
    p: Params<T, U, S>,
  ): SnapshotStream<{ left: T; right: U }> =>
  <Result extends JsonObj>(input: RawStagesPart<{ left: T; right: U }, Result>) =>
    p.left.stages(lStages => p.right.stages(rStages => join(p, lStages, rStages, input)))
