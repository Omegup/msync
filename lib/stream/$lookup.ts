import type { JsonObj } from '../../types'
import { asRowPart, concatParts } from '../aggregate/prefix'
import type {
  Continuation,
  ExecutionResult,
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
}): IteratorResult<readonly Result[], Next<Left, Right>, Next<LDom, RDom>> => {
  type Next<L = Left, R = Right> = { source: 'L'; value: L } | { source: 'R'; value: R }
  type NDom = Next<LDom, RDom>
  const sds = () =>
    mergeIt<'L' | 'R', { L: Left; R: Right }, Result, { L: LDom; R: RDom }>({
      L: lsource,
      R: rsource,
    })
  const run = (): IteratorResult<readonly Result[], Next, NDom> => {
    let { data: l, next: lnext, cont: lcont, stop: lstop } = lsource
    let { data: r, next: rnext, cont: rcont, stop: rstop } = rsource
    const cont: Continuation<readonly Result[], Next, NDom> =
      (prev: Next) =>
      <E>(consume: <N extends NDom>(next: IteratorResult<readonly Result[], N, NDom>) => E): E => {
        if (prev.source === 'L') {
          return lcont(prev.value)(lnext => consume(merge({ lsource: lnext, rsource })))
        } else {
          return rcont(prev.value)(rnext => consume(merge({ lsource, rsource: rnext })))
        }
      }
    return {
      data: [...l, ...r],
      next: Promise.race<Next>([
        lnext.then(x => ({ source: 'L', value: x })),
        rnext.then(x => ({ source: 'R', value: x })),
      ]),
      cont,
      stop: () => {
        lstop()
        rstop()
      },
    }
  }
  return mergeIt<'L' | 'R', { L: Left; R: Right }, Result, { L: LDom; R: RDom }>({
      L: lsource,
      R: rsource,
    })
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
            run: <Result2 extends JsonObj>(
              nextInput: RawStagesPart<Result, Result2>,
            ): Runner<readonly Result2[]> => {
              const joinL_Snapshot = asRowPart<U, { left: T; right: U }>([])
              const lRunner = left.run(concatParts(lRunnerInput, nextInput))
              const rRunner = right.run(concatParts(concatParts(joinL_Snapshot, input), nextInput))
              const runner =
                () =>
                <E>(
                  consume: <N extends unknown>(
                    next: IteratorResult<readonly Result2[], N, unknown>,
                  ) => E,
                ): E => {}
              const er: Runner<readonly Result2[]> = () => consume =>
                lRunner(lsource => rRunner(rsource => consume(merge({ lsource, rsource }))))
              return runner
            },
          }
        },
      ),
    )
