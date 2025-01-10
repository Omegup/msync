import type { AsLiteral, ID, O, RORec, Rec, doc, notArr } from '../../types'
import { $lookupDelta, $lookupRaw } from '../aggregate/lookup'
import { concatStages, concatTStages, emptyDelta } from '../aggregate/prefix'
import { $replaceWithDelta } from '../aggregate/set'
import { $mergeObjects } from '../expression/array'
import { fieldM } from '../expression/concat'
import { root, type Field } from '../field'
import type { Delta, DeltaStages, HasJob, IteratorResult, Runner, TStages } from '../types'
import type {
  Before,
  RawStages,
  SnapshotStream,
  SnapshotStreamExecutionResult,
  UBefore,
} from '../types/stream'

import { asBefore } from '../utils/before'
import { createIndex } from '../utils/db-indexes'
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
  LQ extends doc,
  Q2 extends O,
  LE extends LQ,
  LS extends UBefore<LQ>,
  BLB extends Before<LQ>,
  RQ extends O,
  RE extends RQ & doc,
  S extends notArr,
  RS extends UBefore<RQ>,
  BRB extends Before<RQ>,
  Result extends Q2,
>(
  { lField, rField, left, right, as }: LookupParams<As, LQ, LE, RQ, RE, S>,
  leftSnapshot: TStages<LS, Before<LQ>, BLB, Before<LE>>,
  rightSnapshot: TStages<RS, Before<RQ>, BRB, Before<RE>>,
  stagesUntilNextLookup: DeltaStages<LQ | Q2, LE & RORec<As, RE>, Result>,
): SnapshotStreamExecutionResult<LQ | Q2, Result> => {
  createIndex(leftSnapshot.coll, { [lField.str()]: 1 }).catch(
    e => e.code == 86 || Promise.reject(e),
  )
  createIndex(rightSnapshot.coll, { [rField.str()]: 1 }).catch(
    e => e.code == 86 || Promise.reject(e),
  )

  const rightJoinField = { field1: lField, field2: rField }
  // const joinId = lField.str() === '_id' ? 'right' : rField.str() === '_id' ? 'left' : false
  const joinId = 'left'
  const joinR_Snapshot: RawStages<
    Before<LQ | Q2>,
    Before<LE>,
    Before<LE & Rec<As, RE> & ID>
  > = asBefore($lookupRaw(rightJoinField, rightSnapshot, as, joinId))
  const resultingSnapshot = concatTStages(leftSnapshot, joinR_Snapshot)
  const dict = { [as]: 'a' } as RORec<As, 'a'>
  const dictId: RORec<As, 'a'> & RORec<'_id', 'b'> = { ...dict, _id: 'b' }
  return {
    stages: consume =>
      consume(concatTStages(resultingSnapshot, asBefore(stagesUntilNextLookup.raw))),
    out: <Final>(
      finalInput: RawStages<unknown, Delta<Result>, Final>,
    ): Runner<readonly Final[], HasJob> => {
      const leftJoinField = { field1: rField, field2: lField }
      type LeftRight = Rec<'left', LE> & Rec<'right', RE> & ID
      type JoinStages<RR> = RawStages<unknown, Delta<RR>, Delta<LeftRight>>
      const joinL_Delta: JoinStages<RE> = $lookupDelta<RQ, RE, LQ, LE, BLB, LS, S, 'right', 'left'>(
        leftJoinField,
        leftSnapshot,
        'right',
        'left',
        joinId,
      )
      const joinR_Delta: JoinStages<LE> = $lookupDelta<LQ, LE, RQ, RE, BRB, RS, S, 'left', 'right'>(
        rightJoinField,
        rightSnapshot,
        'left',
        'right',
        joinId,
      )
      const mergeForeignIntoDoc = concatStages<
        unknown,
        Delta<LeftRight>,
        Delta<LE & RORec<As, RE>>,
        Delta<Result>,
        unknown
      >(
        $replaceWithDelta<LeftRight, LE & RORec<As, RE>>(
          $mergeObjects<LE, ID & RORec<As, RE>, LeftRight>(
            root<LeftRight>().of('left').expr(),
            fieldM<RORec<As, 'a'> & RORec<'_id', 'b'>, { a: RE; b: string }, LeftRight>(
              { a: root<LeftRight>().of('right').expr(), b: root<LeftRight>().of('_id').expr() },
              dictId,
            ),
          ),
        ),
        stagesUntilNextLookup.delta,
      )

      const lRunnerInput = concatStages(joinR_Delta, mergeForeignIntoDoc)
      const rRunnerInput = concatStages(joinL_Delta, mergeForeignIntoDoc)
      const lRunner = left.out(concatStages(lRunnerInput, finalInput))
      const rRunner = right.out(concatStages(rRunnerInput, finalInput))

      return () => merge({ lsource: lRunner(), rsource: rRunner() })
    },
  }
}

type Params<As extends string, LQ extends O, RQ extends O, RE extends RQ, S extends notArr> = {
  localField: Field<LQ, S>
  foreignField: Field<RQ, S>
  from: SnapshotStreamExecutionResult<RQ, RE>
  as: AsLiteral<As>
}
type LookupParams<
  As extends string,
  LQ extends O,
  LE extends LQ,
  RQ extends O,
  RE extends RQ,
  S extends notArr,
> = {
  lField: Field<LQ, S>
  rField: Field<RQ, S>
  right: SnapshotStreamExecutionResult<RQ, RE>
  as: AsLiteral<As>
  left: SnapshotStreamExecutionResult<LQ, LE>
}

export const $lookup1 =
  <
    As extends string,
    LQ extends doc,
    LE extends LQ,
    RQ extends O,
    RE extends RQ & doc,
    S extends notArr,
  >(
    p: LookupParams<As, LQ, LE, RQ, RE, S>,
  ): SnapshotStream<LQ, LE & RORec<As, RE>> =>
  <Q2 extends O, Result extends Q2>(
    input: DeltaStages<Q2 | (LE & RORec<As, RE>), LE & RORec<As, RE>, Result>,
  ) =>
    p.left.stages(
      <LS extends UBefore<LQ>, BLB extends Before<LQ>>(
        lStages: TStages<LS, Before<LQ>, BLB, Before<LE>, number>,
      ) =>
        p.right.stages(
          <RS extends UBefore<RQ>, BRB extends Before<RQ>>(
            rStages: TStages<RS, Before<RQ>, BRB, Before<RE>>,
          ) =>
            join<As, LQ, Q2, LE, LS, BLB, RQ, RE, S, RS, BRB, Result>(p, lStages, rStages, input),
        ),
    )
export const $lookup =
  <As extends string, LQ extends doc, RQ extends O, RE extends RQ & doc, S extends notArr>(
    p: Params<As, LQ, RQ, RE, S>,
  ) =>
  <LE extends LQ>(l: SnapshotStream<LQ, LE>): SnapshotStream<LQ, LE & RORec<As, RE>> =>
    $lookup1<As, LQ, LE, RQ, RE, S>({
      right: p.from,
      as: p.as,
      lField: p.localField,
      rField: p.foreignField,
      left: l(emptyDelta()),
    })
