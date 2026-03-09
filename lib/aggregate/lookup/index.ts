import {
  UUID,
  type AsLiteral,
  type ID,
  type O,
  type RORec,
  type Rec,
  type doc,
  type notArr,
} from '../../../types'
import { mergeObjects } from '../../expression/array'
import { fieldM } from '../../expression/concat'
import { root, type Field } from '../../field'
import type { Delta, DeltaStages, HasJob, IteratorResult, Runner, TStages } from '../../types'
import type {
  BA,
  Before,
  RawStages,
  SnapshotStream,
  SnapshotStreamExecutionResult,
  StreamRunnerParam,
  UBefore,
} from '../../types/stream'
import { concatStages, concatTStages, emptyDelta } from '../prefix'
import { $replaceWithDelta } from '../set/$set-delta'
import { $lookupDelta } from './$lookup-delta'
import { $lookupRaw } from './$lookup-raw'

import { asBefore } from '../../utils/before'
import { createIndex } from '../../utils/db-indexes'
import { mergeIterators } from '../../utils/merge'
import { log } from '../../utils'

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
  Null extends null = never,
>(
  { lField, rField, left, right, as }: LookupParams<As, LQ, LE, RQ, RE, S>,
  leftSnapshot: TStages<LS, Before<LQ>, BLB, Before<LE>>,
  rightSnapshot: TStages<RS, Before<RQ>, BRB, Before<RE>>,
  stagesUntilNextLookup: DeltaStages<LQ | Q2, LE & RORec<As, RE | Null>, Result>,
  outerLeft?: Null,
): SnapshotStreamExecutionResult<LQ | Q2, Result> => {
  const rightJoinField = { field1: lField, field2: rField }
  // const joinId = lField.str() === '_id' ? 'right' : rField.str() === '_id' ? 'left' : false
  const joinId = 'left'
  const joinR_Snapshot: RawStages<
    Before<LQ | Q2>,
    Before<LE>,
    Before<LE & Rec<As, RE | Null> & ID>
  > = asBefore($lookupRaw(rightJoinField, rightSnapshot, as, joinId, outerLeft))
  const resultingSnapshot = concatTStages(leftSnapshot, joinR_Snapshot)
  const dict = { [as]: 'a' } as RORec<As, 'a'>
  const idB: RORec<'_id', 'b'> = { _id: 'b' }
  const dictId: RORec<As, 'a'> & RORec<'_id', 'b'> = { ...dict, ...idB }
  return {
    stages: consume =>
      consume(concatTStages(resultingSnapshot, asBefore(stagesUntilNextLookup.raw))),
    out: <Final>(
      finalInput: StreamRunnerParam<Delta<Result>, Final>,
    ): Runner<readonly Final[], HasJob> => {
      const leftJoinField = { field1: rField, field2: lField }
      type L = 'left'
      type R = 'right'
      type LeftRight = Rec<L, LE> & Rec<R, RE | Null> & ID
      type JoinStages<RR> = RawStages<unknown, Delta<RR>, Delta<LeftRight>>
      const joinL_Delta: JoinStages<RE> = $lookupDelta<RQ, RE, LQ, LE, BLB, LS, S, R, L, Null>(
        leftJoinField,
        leftSnapshot,
        'right',
        'left',
        joinId,
        outerLeft,
      )
      const joinR_Delta: JoinStages<LE> = $lookupDelta<
        LQ,
        LE,
        RQ,
        RE,
        BRB,
        RS,
        S,
        L,
        R,
        never,
        Null
      >(rightJoinField, rightSnapshot, 'left', 'right', joinId, undefined, outerLeft)

      type OuterLE = LE

      const mergeForeignIntoDoc = concatStages<
        unknown,
        Delta<LeftRight>,
        Delta<OuterLE & RORec<As, RE | Null>>,
        Delta<Result>,
        unknown
      >(
        $replaceWithDelta<LeftRight, OuterLE & RORec<As, RE | Null>>(
          mergeObjects<LE, ID & RORec<As, RE | Null>, LeftRight>(
            root<LeftRight>().of('left').expr(),
            fieldM<RORec<As, 'a'> & RORec<'_id', 'b'>, { a: RE | Null; b: string }, LeftRight>(
              { a: root<LeftRight>().of('right').expr(), b: root<LeftRight>().of('_id').expr() },
              dictId,
            ),
          ),
        ),
        stagesUntilNextLookup.delta,
      )

      const lRunnerInput = concatStages(joinR_Delta, mergeForeignIntoDoc)
      const rRunnerInput = concatStages(joinL_Delta, mergeForeignIntoDoc)
      const getRunner = <Q, V extends Q, B, C>(
        f: SnapshotStreamExecutionResult<Q, V>,
        stages: RawStages<unknown, Delta<V, BA, ID>, Delta<B>>,
        final: StreamRunnerParam<Delta<B>, C>,
      ) =>
        f.out(
          {
            raw: first => concatStages(stages, final.raw(first)),
            teardown: final.teardown,
          },
          async () => {
            log('Creating indexes for lookup left', leftSnapshot.coll.collectionName, {
              [`before.${lField.str()}`]: 1,
            })
            await createIndex(
              leftSnapshot.coll,
              { [`before.${lField.str()}`]: 1 },
              { name: 'left_' + new UUID().toString('base64') },
            )
            log('Creating indexes for lookup right', rightSnapshot.coll.collectionName, {
              [`before.${rField.str()}`]: 1,
            })
            await createIndex(
              rightSnapshot.coll,
              { [`before.${rField.str()}`]: 1 },
              { name: 'right_' + new UUID().toString('base64') },
            )
          },
        )
      const lRunner = getRunner(left, lRunnerInput, finalInput)
      const rRunner = getRunner(right, rRunnerInput, finalInput)

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

const $lookup1 =
  <
    As extends string,
    LQ extends doc,
    LE extends LQ,
    RQ extends O,
    RE extends RQ & doc,
    S extends notArr,
    Null extends null = never,
  >(
    p: LookupParams<As, LQ, LE, RQ, RE, S>,
    outerLeft?: Null,
  ): SnapshotStream<LQ, LE & RORec<As, RE | Null>> =>
  <Q2 extends O, Result extends Q2>(
    input: DeltaStages<Q2 | (LE & RORec<As, RE | Null>), LE & RORec<As, RE | Null>, Result>,
  ) =>
    p.left.stages(
      <LS extends UBefore<LQ>, BLB extends Before<LQ>>(
        lStages: TStages<LS, Before<LQ>, BLB, Before<LE>, number>,
      ) =>
        p.right.stages(
          <RS extends UBefore<RQ>, BRB extends Before<RQ>>(
            rStages: TStages<RS, Before<RQ>, BRB, Before<RE>>,
          ) =>
            join<As, LQ, Q2, LE, LS, BLB, RQ, RE, S, RS, BRB, Result, Null>(
              p,
              lStages,
              rStages,
              input,
              outerLeft,
            ),
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

export const $outerLookup =
  <As extends string, LQ extends doc, RQ extends O, RE extends RQ & doc, S extends notArr>(
    p: Params<As, LQ, RQ, RE, S>,
  ) =>
  <LE extends LQ>(l: SnapshotStream<LQ, LE>): SnapshotStream<LQ, LE & RORec<As, RE | null>> =>
    $lookup1<As, LQ, LE, RQ, RE, S, null>(
      {
        right: p.from,
        as: p.as,
        lField: p.localField,
        rField: p.foreignField,
        left: l(emptyDelta()),
      },
      null,
    )
