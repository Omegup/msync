import type { JsonObj } from '../../types'
import { asRowPart, concatParts } from '../aggregate/prefix'
import type {
  ExecutionResult,
  RawStagesPart,
  RawStagesSource,
  RunnerSource,
  StreamSnapshot,
} from '../types'

const lookupRunner = <Left, Right, Result2>({
  lsource,
  rsource,
}: {
  lsource: RunnerSource<readonly Result2[], Left>
  rsource: RunnerSource<readonly Result2[], Right>
}) => {
  type Next = { source: 'L'; value: Left } | { source: 'R'; value: Right }
  async function* run(): RunnerSource<readonly Result2[], Next> {
    while (true) {
      let [l, lnext] = (await lsource.next()).value
      let [r, rnext] = (await rsource.next()).value
      while (true) {
        const request = yield [
          [...l, ...r],
          Promise.race<Next>([
            lnext.then(x => ({ source: 'L', value: x })),
            rnext.then(x => ({ source: 'R', value: x })),
          ]),
        ]
        if (!request) break
        if (request.source === 'L') {
          ;[l, lnext] = (await lsource.next(request.value)).value
        }
      }
    }
  }
  return run()
}

export const $lookup =
  <T extends JsonObj, U extends JsonObj>(
    left: ExecutionResult<T>,
    right: ExecutionResult<U>,
  ): StreamSnapshot<{ left: T; right: U }> =>
  <Result extends JsonObj>(input: RawStagesPart<{ left: T; right: U }, Result>) =>
    left.stages(<L>({ stages: lStages, coll: lColl }: RawStagesSource<L, T>) =>
      right.stages(
        <R>({ stages: rStages, coll: rColl }: RawStagesSource<R, U>): ExecutionResult<Result> => {
          const joinR_Snapshot = asRowPart<T, { left: T; right: U }>([])
          const lRunnerInput = concatParts(joinR_Snapshot, input)
          return {
            stages: consume =>
              consume({
                coll: lColl,
                stages: concatParts(lStages, lRunnerInput),
              }),
            run: nextInput => {
              const joinL_Snapshot = asRowPart<U, { left: T; right: U }>([])
              const lRunner = left.run(concatParts(lRunnerInput, nextInput))
              const rRunner = right.run(concatParts(concatParts(joinL_Snapshot, input), nextInput))
              return consume =>
                lRunner(lsource => rRunner(rsource => consume(lookupRunner({ lsource, rsource }))))
            },
          }
        },
      ),
    )
