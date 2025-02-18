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
import { concat, type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { $rand, current, val } from '../../../expression/val'
import { ctx, root } from '../../../field'
import type { Expr, RawStages, TS } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { set, to, type Updater, type UpdaterHKT } from '../../../update/updater'
import { map1 } from '../../../utils/json'
import { mapExact0, type MapO, type MappedHKT } from '../../../utils/map-object'
import { $set_ } from '../../mongo-stages'
import { $merge_, type MergeInto } from '../../out'
import { link } from '../../prefix'

type GI<GG> = Exclude<GG, keyof TS>
export type IdAndTsKeys = keyof (TS & ID)

// TS & ID & V_Grp & Extra
type V<VV, GG extends string> = Omit<VV, IdAndTsKeys | GI<GG>>
export type Prepare<Grp, GG extends string> = TS & ID & Rec<GI<GG>, Grp>
export type Loose<Grp, VV, GG extends string> = Prepare<Grp, GG> & Partial<V<VV, GG>>
export type Strict<Grp, VV, GG extends string, EE> = Prepare<Grp, GG> &
  V<VV, GG> &
  Omit<EE, IdAndTsKeys | GI<GG> | keyof V<VV, GG>>
export type V_Grp<VV, GG extends string, Grp> = Rec<GI<GG>, Grp> & V<VV, GG>
export type Extra<EE, VV, GG extends string> = Omit<EE, IdAndTsKeys | GI<GG> | keyof V<VV, GG>>
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
    WriteonlyCollection<Replace<Out, Strict<Grp, VV, GG, EE>>>
  >,
  gid: AsLiteral<GI<GG>>,
  // ExprsExact<Extra, V_Grp>
  extra: ExprsExact<Extra<EE, VV, GG>, V_Grp<VV, GG, Grp>>,
  idPrefix: string
): RawStages<unknown, V_Grp<VV, GG, Grp>, 'out'> => {
  type GID = GI<GG>
  type V_Grp = Rec<GID, Grp> & V
  // TS & ID & V_Grp & Extra
  type ReadyForMerge = TS & ID & V_Grp & Extra
  type Denied = IdAndTsKeys | GID
  type V = Omit<VV, Denied>
  type PV = Partial<V>
  type New = RORec<'new', ReadyForMerge>
  type Extra = Omit<EE, IdAndTsKeys | GID | keyof V>

  const doubleReplace = (
    x: RawStages<O, Replace<Out, V>, Replace<Replace<Out, V>, Extra & TS>, New>,
  ) => x as RawStages<O, Replace<Out, V>, Replace<Out, ReadyForMerge>, New>
  const mergeAggregates: RawStages<O, Out, Replace<Out, V>, New> = $set_<
    O,
    Out,
    Replace<Out, V>,
    New
  >(
    set<V>()(
      mapExact0<V, MappedHKT<V, DeltaAccumulatorHKT<T>>, Update<Out, V, New>>(args, (v, k) =>
        to(v.merge<Out, New>(root<O<PV>>().of(k).expr(), ctx<O<V>>()('new').of(k).expr())),
      ),
    ),
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
    ...mapExact0<Extra, MappedHKT<Extra, ExprHKT<V_Grp>>, Update<V_Grp, Extra>>(extra, to),
    touchedAt: ['touchedAt', to(current)],
  } as MapO<Extra & TS, Update<Replace<Out, V>, Extra & TS, New>>

  const updater: Updater<
    Replace<Out, V>,
    Replace<Out, V>,
    Replace<Replace<Out, V>, Extra & TS>,
    New
  > = set<Extra & TS>()<Replace<Out, V>, Replace<Out, V>, New>(addTSAndExtra)

  return (
    link<V_Grp>()
      .with<unknown, ReadyForMerge>(
        $set_<O, V_Grp, ReadyForMerge>(
          set<TS & ID & RORec<GID, Grp> & Extra>()<V_Grp, V_Grp>(addExtraAndMerge) as Updater<
            V_Grp,
            V_Grp,
            ReadyForMerge
          >,
        ),
      )
      // TODO filter out documents with 0 change
      .with<unknown, 'out'>(
        $merge_<ReadyForMerge, Out, New, Replace<Out, ReadyForMerge>>({
          ...out,
          vars: { new: ['new', root<ReadyForMerge>().expr()] },
          stages: 'ctx',
          on: root<Out | ReadyForMerge>().of(gid),
          whenMatched: link<Out, New>()
            .with<O, Replace<Out, V>>(mergeAggregates)
            .with<O, Replace<Out, ReadyForMerge>>(doubleReplace($set_(updater))).stages,
        }),
      ).stages
  )
}
