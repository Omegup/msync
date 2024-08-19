import type { JsonObj } from '../../types'
import { asRowPart, concatParts } from '../aggregate/prefix'
import type {
  Continuation,
  ExecutionResult,
  IteratorResult,
  RawStagesPart,
  RawStagesSource,
  Runner,
  RunnerSource,
  StreamSnapshot,
} from '../types'

const merge = () => 0

const lookupRunner = <Left, Right, Result>({
  lsource,
  rsource,
}: {
  lsource: RunnerSource<readonly Result[], Left>
  rsource: RunnerSource<readonly Result[], Right>
}) => {
  type Next<L = Left, R = Right> = { source: 'L'; value: L } | { source: 'R'; value: R }
  const run =
    (): RunnerSource<readonly Result[], Next> => (): IteratorResult<readonly Result[], Next> => {
      let [l, lnext, lcont] = lsource()
      let [r, rnext, rcont] = rsource()
      const cont: Continuation<readonly Result[], Next> = <E>(
        consume: <N>(next: (prev: Next) => IteratorResult<readonly Result[], N>) => E,
      ): E => {
        const lconsume = <L2>(lnext: (prev: Left) => IteratorResult<readonly Result[], L2>): E => {
          return consume<Next<L2, Right> | Next>((prev: Next<Left, Right>): IteratorResult<readonly Result[], Next<L2, Right> | Next> => {
            if(prev.source === 'L') {
              return lookupRunner({ lsource: ()=>lnext(prev.value), rsource })()
            }
            return null
          })
        }
        return lcont(lconsume)
      }
      return [
        [...l, ...r],
        Promise.race<Next>([
          lnext.then(x => ({ source: 'L', value: x })),
          rnext.then(x => ({ source: 'R', value: x })),
        ]),
        cont,
        () => {},
      ]
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

const lookupRunnerr =
  <Result>(
    lRunner: Runner<readonly Result[]>,
    rRunner: Runner<readonly Result[]>,
  ): Runner<readonly Result[]> =>
  consume =>
    lRunner(lsource => rRunner(rsource => consume(lookupRunner({ lsource, rsource }))))
