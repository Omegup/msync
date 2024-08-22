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
  StreamSnapshot,
} from '../types'
import { mergeIt } from '../utils/merge'

type Next<L, R> = { source: 'L'; value: L } | { source: 'R'; value: R }

const merge = <Left extends LDom, Right extends RDom, Result, LDom, RDom>({
  lsource,
  rsource,
}: {
  lsource: IteratorResult<readonly Result[], Left, LDom>
  rsource: IteratorResult<readonly Result[], Right, RDom>
}): IteratorResult<readonly Result[], Next<Left, Right>, Next<LDom, RDom>> =>
  mergeIt<'L' | 'R', { L: Left; R: Right }, Result, { L: LDom; R: RDom }>({
    L: lsource,
    R: rsource,
  })

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
    ): Runner<readonly Final[], unknown> => {
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
  lField: Field<T, S>
  rField: Field<U, S>
  left: SnapshotStreamExecutionResult<T>
  right: SnapshotStreamExecutionResult<U>
}
export const $lookup =
  <T extends JsonObj, U extends JsonObj, S>(
    p: Params<T, U, S>,
  ): StreamSnapshot<{ left: T; right: U }> =>
  <Result extends JsonObj>(input: RawStagesPart<{ left: T; right: U }, Result>) =>
    p.left.stages(lStages => p.right.stages(rStages => join(p, lStages, rStages, input)))
