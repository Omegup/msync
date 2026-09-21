import { getWhenMatched } from '../../$merge'
import type {
  App,
  AsLiteral,
  HKT,
  ID,
  O,
  RORec,
  Rec,
  Replace,
  WriteonlyCollection,
  notArr,
} from '../../../../types'
import { concat, field, type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { $rand, current, nil, val } from '../../../expression/val'
import { ctx, root } from '../../../field'
import type { Expr, Model, RawStages, TS } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { set, subUpdater, to, type Updater, type UpdaterHKT } from '../../../update/updater'
import { map1 } from '../../../utils/json'
import { mapExact0, type MapO, type MappedHKT } from '../../../utils/map-object'
import { $replaceWith_, $set_ } from '../../mongo-stages'
import { $merge_, type MergeInto } from '../../out'
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

export type MergedInput<Out, VV, Grp, GG extends string, EE> = OrReplace<
  Replace<Replace<Out, V<VV, GG>>, Extra<EE, VV, GG>> & Model,
  TS & ID & V_Grp<VV, GG, Grp> & Extra<EE, VV, GG>
>

export const subMerge = <
  T extends O,
  Grp extends notArr,
  VV extends O,
  GG extends string,
  EE = {},
  Out extends Loose<Grp, VV, GG> = Loose<Grp, VV, GG>,
>(
  args: DeltaAccumulators<T, V<VV, GG>>,
  out: MergeInto<
    Strict<Grp, VV, GG, EE>,
    Out,
    WriteonlyCollection<MergedInput<Out, VV, Grp, GG, EE>>
  >,
  gid: AsLiteral<GI<GG>>,
  // ExprsExact<Extra, V_Grp>
  extra: ExprsExact<Extra<EE, VV, GG>, V_Grp<VV, GG, Grp>>,
  idPrefix: string,
  first: boolean,
): RawStages<unknown, V_Grp<VV, GG, Grp>, 'out'> => {
  type GID = GI<GG>
  type V_Grp = Rec<GID, Grp> & V
  // TS & ID & V_Grp & Extra
  type ReadyForMerge = TS & ID & V_Grp & Extra
  type Denied = IdAndTsKeys | GID
  type V = Omit<VV, Denied>
  type PV = Par<V>
  type New = RORec<'new', ReadyForMerge>
  type Extra = Omit<EE, IdAndTsKeys | GID | keyof V>

  const e = extra as ExprsExact<Extra, ReadyForExtra>
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
  >(gid, to(gidPath as Expr<(TS & ID & RORec<GID, Grp> & Extra)[GID], V_Grp>))
  type Added = ID & TS & RORec<GID, Grp> & Extra
  const addExtraAndMerge = {
    ...mapExact0<Extra, MappedHKT<Extra, ExprHKT<V_Grp>>, Update<V_Grp, Extra>>(extra, to),
    ...F1,
    ...F2,
  } as MapO<Added, Update<V_Grp, Added>>

  const addTSAndExtra = {
    ...mapExact0<Extra, MappedHKT<Extra, ExprHKT<ReadyForExtra>>, Update<ReadyForExtra, Extra>>(
      e,
      to,
    ),
    ...(out.whenNotMatched === 'insert' ? { deletedAt: ['deletedAt', to(nil)] } : {}),
    touchedAt: ['touchedAt', to(current)],
  } as MapO<Extra, Update<ReadyForExtra, Extra, New>>

  type ReadyForExtra = Replace<Out, V>
  type ReadyForWhenMatched = Replace<ReadyForExtra, Extra>

  const updater: Updater<ReadyForExtra, ReadyForExtra, ReadyForWhenMatched, New> = set<Extra>()<
    ReadyForExtra,
    ReadyForExtra,
    New
  >(addTSAndExtra)

  type In = OrReplace<ReadyForWhenMatched, ReadyForMerge>

  type WhenMatched = RawStages<O, Rec<'old' | 'merged', Out | Replace<Replace<Out, V>, Extra>>, In>
  const whenMatched = getWhenMatched<Out, Replace<V, Extra> & Model, never>(
    out.whenNotMatched,
  ) as WhenMatched

  return link<V_Grp>()
    .with<unknown, ReadyForMerge>(
      $set_<O, V_Grp, ReadyForMerge>(
        set<TS & ID & RORec<GID, Grp> & Extra>()<V_Grp, V_Grp>(addExtraAndMerge) as Updater<
          V_Grp,
          V_Grp,
          ReadyForMerge
        >,
      ),
    )
    .with<unknown, 'out'>(
      $merge_<ReadyForMerge, Out, New, In>({
        ...out,
        on: root<Out | ReadyForMerge>().of(gid),
        vars: { new: ['new', root<ReadyForMerge>().expr()] },
        stages: 'ctx',
        whenMatched: link<Out, New>()
          .with<O, OldAndNew>(
            $replaceWith_(
              field({ old: ['old', root<Out>().expr()], merged: ['merged', root<Out>().expr()] }),
            ),
          )
          .with<O, OldAndNew<ReadyForExtra>>(mergeAggregates)
          .with<O, OldAndNew<ReadyForWhenMatched>>(
            $set_<O, OldAndNew<ReadyForExtra>, OldAndNew<ReadyForWhenMatched>>(
              set<Rec<'merged', ReadyForWhenMatched>>()({
                merged: [
                  'merged',
                  subUpdater(updater, root<OldAndNew<ReadyForExtra>>().of('merged')),
                ],
              }),
            ),
          )
          .with<O, In>(whenMatched).stages,
      }),
    ).stages
}
