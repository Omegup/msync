import { getWhenMatched } from '../../$merge'
import type {
  App,
  AsLiteral,
  HKT,
  ID,
  O,
  RWCollection,
  RORec,
  Rec,
  Replace,
  notArr,
  Omit,
  Exclude,
} from '../../../../types'
import { concat, field, type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { $rand, current, nil, val } from '../../../expression/val'
import { ctx, root } from '../../../field'
import type { Expr, IsDeleted, Model, RawStages, TS } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { set, subUpdater, to, type Get, type Updater, type UpdaterHKT } from '../../../update/updater'
import { map1 } from '../../../utils/json'
import { mapExact0, spread0, type MapO, type MappedHKT, type MergeHKT } from '../../../utils/map-object'
import { $replaceWith_, $set_ } from '../../mongo-stages'
import { $merge_ } from '../../out'
import { link } from '../../prefix'

type GI<GG> = Exclude<GG, keyof TS>
export type IdAndTsKeys = keyof (TS & ID)

// TS & ID & V_Grp & Extra
type V<VV, GG extends string> = Omit<VV, IdAndTsKeys | GI<GG>>
export type Prepare<Grp, GG extends string> = TS & ID & Rec<GI<GG>, Grp>
type Par<T> = { [P in keyof T]?: T[P] | null }

export type Loose<Grp, VV, GG extends string> = Prepare<Grp, GG> & Par<V<VV, GG>>
export type Strict<Grp, VV, GG extends string, EE> = Prepare<Grp, GG> &
  V<VV, GG> &
  Omit<EE, IdAndTsKeys | GI<GG> | keyof V<VV, GG>>
export type V_Grp<VV, GG extends string, Grp> = Rec<GI<GG>, Grp> & V<VV, GG>
export type Extra<EE, VV, GG extends string> = Omit<EE, IdAndTsKeys | GI<GG> | keyof V<VV, GG>>

type OrReplace<T, V> = T | Replace<T, V>
type ND = { readonly deletedAt?: null }

type StrictReady<Grp extends notArr, VV extends O, GG extends string, EE> = TS &
  ID &
  V_Grp<VV, GG, Grp> &
  Extra<EE, VV, GG>
type InsertReady<Grp extends notArr, VV extends O, GG extends string, EE> = Replace<
  StrictReady<Grp, VV, GG, EE>,
  ND
>
type DiscardReady<Grp extends notArr, VV extends O, GG extends string, EE> = Replace<
  StrictReady<Grp, VV, GG, EE>,
  IsDeleted
>
type MatchedReady<Out, VV extends O, GG extends string, EE> = Replace<
  Out,
  Replace<V<VV, GG>, Extra<EE, VV, GG>> & Model
>
type MatchedIn<Out, VV extends O, GG extends string, EE> = Out | MatchedReady<Out, VV, GG, EE>

export type MergedInput<Out, VV, Grp, GG extends string, EE> = OrReplace<
  Replace<Replace<Out, V<VV, GG>>, Extra<EE, VV, GG>> & Model,
  TS & ID & V_Grp<VV, GG, Grp> & Extra<EE, VV, GG>
>

type SubMergeInInsert<Out, VV extends O, Grp extends notArr, GG extends string, EE> =
  MatchedIn<Out, VV, GG, EE> | InsertReady<Grp, VV, GG, EE>
type SubMergeInDiscard<Out, VV extends O, Grp extends notArr, GG extends string, EE> =
  MatchedIn<Out, VV, GG, EE> | DiscardReady<Grp, VV, GG, EE>
export type SubMergeInFail<
  Out,
  VV extends O,
  Grp extends notArr,
  GG extends string,
  EE,
> = OrReplace<MatchedReady<Out, VV, GG, EE>, StrictReady<Grp, VV, GG, EE>>

type SubMergeIntoFail<
  Grp extends notArr,
  VV extends O,
  GG extends string,
  EE,
  Out extends Loose<Grp, VV, GG>,
> = RWCollection<MatchedIn<Out, VV, GG, EE>, Out>

type SubMergeIntoInsert<
  Grp extends notArr,
  VV extends O,
  GG extends string,
  EE,
  Out extends Loose<Grp, VV, GG>,
> = RWCollection<SubMergeInInsert<Out, VV, Grp, GG, EE>, Out>

type SubMergeIntoDiscard<
  Grp extends notArr,
  VV extends O,
  GG extends string,
  EE,
  Out extends Loose<Grp, VV, GG>,
> = RWCollection<SubMergeInDiscard<Out, VV, Grp, GG, EE>, Out>

export type SubMergeOut<
  Grp extends notArr,
  VV extends O,
  GG extends string,
  EE = {},
  Out extends Loose<Grp, VV, GG> = Loose<Grp, VV, GG>,
> =
  | { whenNotMatched: 'insert'; into: SubMergeIntoInsert<Grp, VV, GG, EE, Out> }
  | { whenNotMatched: 'discard'; into: SubMergeIntoDiscard<Grp, VV, GG, EE, Out> }
  | { whenNotMatched: 'fail'; into: SubMergeIntoFail<Grp, VV, GG, EE, Out> }

export const subMerge = <
  T extends O,
  Grp extends notArr,
  VV extends O,
  GG extends string,
  EE = {},
  Out extends Loose<Grp, VV, GG> = Loose<Grp, VV, GG>,
>(
  args: DeltaAccumulators<T, V<VV, GG>>,
  out: SubMergeOut<Grp, VV, GG, EE, Out>,
  gid: AsLiteral<GI<GG>>,
  // ExprsExact<Extra, V_Grp>
  extra: ExprsExact<Extra<EE, VV, GG>, V_Grp<VV, GG, Grp>>,
  idPrefix: string,
  first: boolean,
): RawStages<unknown, V_Grp<VV, GG, Grp>, 'out'> => {
  type GID = GI<GG>
  type V_Grp = Rec<GID, Grp> & V
  // TS & ID & V_Grp & Extra
  type ReadyForMerge = StrictReady<Grp, VV, GG, EE>
  type Denied = IdAndTsKeys | GID
  type V = Omit<VV, Denied>
  type PV = Par<V>
  type New = RORec<'new', ReadyForMerge>
  type Extra = Omit<EE, IdAndTsKeys | GID | keyof V>

  const e: ExprsExact<Extra, ReadyForExtra> = extra
  type OldAndNew<T = Out> = Rec<'old', Out> & Rec<'merged', T>
  const mergeOldWithNew: MapO<V, UpdaterHKT<OldAndNew, Out, V, New, never>> = mapExact0<
    V,
    MappedHKT<V, DeltaAccumulatorHKT<T>>,
    UpdaterHKT<OldAndNew, Out, V, New, never>
  >(args, (v, k) =>
    to(
      first
        ? ctx<O<V>>()('new').of(k).expr()
        : v.merge<OldAndNew, New>(
            root<Rec<'old', O<PV>>>().of('old').of(k).expr(),
            ctx<O<V>>()('new').of(k).expr(),
          ),
    ),
  )

  const mergeAggregates: RawStages<O, OldAndNew, OldAndNew<Replace<Out, V>>, New> = $set_<
    O,
    OldAndNew,
    OldAndNew<Replace<Out, V>>,
    New
  >(
    set<Rec<'merged', Replace<Out, V>>>()({
      merged: ['merged', set<V>()(mergeOldWithNew)],
    }),
  )

  type Update<R, X, C = unknown, Subset extends X = X> = UpdaterHKT<R, R, X, C, never, Subset>
  const gidPath: Expr<Grp, V_Grp> = root<V_Grp>().of(gid).expr()

  type ExtraAndId = ID & TS & Extra
  type InsertReady = Replace<ReadyForMerge, ND>
  type DiscardReady = Replace<ReadyForMerge, IsDeleted>
  type ExtraAndIdHKT = MergeHKT<
    Extra,
    ID & TS,
    Update<V_Grp, Extra>,
    Update<V_Grp, ID & TS>
  >
  const mapId = <K extends string, F extends HKT<K>, X>(
    k: AsLiteral<K>,
    v: App<F, K>,
  ): MapO<RORec<K, X>, F> => map1(k, v)

  const F1: MapO<ID & TS, Update<V_Grp, ID & TS>> = {
    _id: ['_id', to(idPrefix ? concat(val(idPrefix), $rand) : $rand)],
    touchedAt: ['touchedAt', to(current)],
  }
  const F2: MapO<RORec<GID, Grp>, Update<V_Grp, RORec<GID, Grp>>> = mapId<
    GID,
    Update<V_Grp, RORec<GID, Grp>>,
    Grp
  >(gid, to(gidPath))
  const extraAndId: MapO<ExtraAndId, ExtraAndIdHKT> = spread0<
    Extra,
    ID & TS,
    Update<V_Grp, Extra>,
    Update<V_Grp, ID & TS>
  >(
    mapExact0<Extra, MappedHKT<Extra, ExprHKT<V_Grp>>, Update<V_Grp, Extra>>(extra, to),
    F1,
  )
  const extraIdAndGroup = spread0<
    ExtraAndId,
    RORec<GID, Grp>,
    ExtraAndIdHKT,
    Update<V_Grp, RORec<GID, Grp>>
  >(extraAndId, F2)
  const addExtraAndMerge = extraIdAndGroup as MapO<ReadyForMerge, Update<V_Grp, ReadyForMerge>>

  const addTSAndExtra: MapO<Extra, Update<ReadyForExtra, Extra, New>> = {
    ...mapExact0<Extra, MappedHKT<Extra, ExprHKT<ReadyForExtra>>, Update<ReadyForExtra, Extra>>(
      e,
      to,
    ),
    ...(out.whenNotMatched === 'insert' ? { deletedAt: ['deletedAt', to(nil)] } : {}),
    touchedAt: ['touchedAt', to(current)],
  }

  type ReadyForExtra = Replace<Out, V>
  type ReadyForWhenMatched = Replace<ReadyForExtra, Extra>

  const updater: Updater<ReadyForExtra, ReadyForExtra, ReadyForWhenMatched, New> = set<Extra>()<
    ReadyForExtra,
    ReadyForExtra,
    New
  >(addTSAndExtra)

  type In = MatchedIn<Out, VV, GG, EE>

  type WhenMatched = RawStages<O, Rec<'old' | 'merged', Out | Replace<Replace<Out, V>, Extra>>, In>
  const whenMatched: WhenMatched = getWhenMatched<Out, Replace<V, Extra> & Model>(
    out.whenNotMatched,
    null,
  )

  const whenMatchedStages = link<Out, New>()
    .with<O, OldAndNew>(
      $replaceWith_(
        field({
          old: ['old', root<Out>().expr()],
          merged: ['merged', root<Out>().expr()],
        }),
      ),
    )
    .with<O, OldAndNew<ReadyForExtra>>(mergeAggregates)
    .with<O, OldAndNew<ReadyForWhenMatched>>(
      $set_<O, OldAndNew<ReadyForExtra>, OldAndNew<ReadyForWhenMatched>>(
        set<Rec<'merged', ReadyForWhenMatched>>()({
          merged: ['merged', subUpdater(updater, root<OldAndNew<ReadyForExtra>>().of('merged'))],
        }),
      ),
    )
    .with<O, In>(whenMatched).stages

  const ready = $set_<O, V_Grp, ReadyForMerge>(
    set<ReadyForMerge>()<V_Grp, V_Grp>(addExtraAndMerge),
  )
  const stages = link<V_Grp>().with<unknown, ReadyForMerge>(ready)

  if (out.whenNotMatched === 'insert') {
    const insertMarker = $set_<O, ReadyForMerge, InsertReady>(
      set<ND>()<ReadyForMerge, ReadyForMerge>({
        deletedAt: [
          'deletedAt',
          to<ReadyForMerge, null, unknown, Get<ReadyForMerge, 'deletedAt'>>(nil),
        ],
      }),
    )
    return stages
      .with<unknown, InsertReady>(insertMarker)
      .with<unknown, 'out'>(
        $merge_<InsertReady, Out, New, In>({
          into: out.into,
          whenNotMatched: 'insert',
          on: root<Out | InsertReady>().of(gid),
          vars: {
            new: [
              'new',
              root<InsertReady>().expr() as Expr<ReadyForMerge, InsertReady>,
            ],
          },
          stages: 'ctx',
          whenMatched: whenMatchedStages,
        }),
      ).stages
  }

  if (out.whenNotMatched === 'discard') {
    const discardMarker = $set_<O, ReadyForMerge, DiscardReady>(
      set<IsDeleted>()<ReadyForMerge, ReadyForMerge>({
        deletedAt: [
          'deletedAt',
          to<ReadyForMerge, IsDeleted['deletedAt'], unknown, Get<ReadyForMerge, 'deletedAt'>>(
            current,
          ),
        ],
      }),
    )
    return stages
      .with<unknown, DiscardReady>(discardMarker)
      .with<unknown, 'out'>(
        $merge_<DiscardReady, Out, New, In>({
          into: out.into,
          whenNotMatched: 'insert',
          on: root<Out | DiscardReady>().of(gid),
          vars: {
            new: [
              'new',
              root<DiscardReady>().expr() as Expr<ReadyForMerge, DiscardReady>,
            ],
          },
          stages: 'ctx',
          whenMatched: whenMatchedStages,
        }),
      ).stages
  }

  return stages.with<unknown, 'out'>(
    $merge_<ReadyForMerge, Out, New, In>({
      into: out.into,
      whenNotMatched: 'fail',
      on: root<Out | ReadyForMerge>().of(gid),
      vars: { new: ['new', root<ReadyForMerge>().expr()] },
      stages: 'ctx',
      whenMatched: whenMatchedStages,
    }),
  ).stages
}
