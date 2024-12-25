import type { App, AsLiteral, HKT, ID, O, RORec, Rec, Replace, notArr } from '../../../../types'
import { type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { $rand, now } from '../../../expression/val'
import { ctx, root } from '../../../field'
import type { Expr, RawStages, TS } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { set, to, type Updater, type UpdaterHKT } from '../../../update'
import { map1 } from '../../../utils/json'
import { mapExact0, type MapO, type MappedHKT } from '../../../utils/map-object'
import { $set_ } from '../../mongo-stages'
import { $merge_, type MergeInto } from '../../out'
import { link } from '../../prefix'

type GI<GG> = Exclude<GG, keyof TS>
export type IdAndTsKeys = keyof (TS & ID)

// TS & ID & V_Grp & Extra
type V<VV, GG extends string> = Omit<VV, IdAndTsKeys | GI<GG>>
export type Prepare<Grp, VV, GG extends string, EE, V> = TS &
  ID &
  Rec<GI<GG>, Grp> &
  V &
  Omit<EE, IdAndTsKeys | GI<GG> | keyof Omit<VV, IdAndTsKeys | GI<GG>>>
export type Loose<Grp, VV, GG extends string, EE> = Prepare<Grp, VV, GG, EE, Partial<V<VV, GG>>>
export type Strict<Grp, VV, GG extends string, EE> = Prepare<Grp, VV, GG, EE, V<VV, GG>>

export const subMerge = <
  T extends O,
  Grp extends notArr,
  VV extends O,
  GG extends string,
  EE = {},
  Out extends Loose<Grp, VV, GG, EE> = Loose<Grp, VV, GG, EE>,
>(
  args: DeltaAccumulators<T, Omit<VV, IdAndTsKeys | GI<GG>>>,
  out: MergeInto<Strict<Grp, VV, GG, EE>, Replace<Out, Partial<V<VV, GG>>>>,
  gid: AsLiteral<GI<GG>>,
  // ExprsExact<Extra, V_Grp>
  extra: ExprsExact<
    Omit<EE, IdAndTsKeys | GI<GG> | keyof Omit<VV, IdAndTsKeys | GI<GG>>>,
    Rec<GI<GG>, Grp> & Omit<VV, IdAndTsKeys | GI<GG>>
  >,
): RawStages<unknown, Rec<GI<GG>, Grp> & Omit<VV, IdAndTsKeys | GI<GG>>, 'out'> => {
  type GID = GI<GG>
  type V_Grp = Rec<GID, Grp> & V
  // TS & ID & V_Grp & Extra
  type ReadyForMerge = TS & ID & V_Grp & Extra
  type Denied = IdAndTsKeys | GID
  type V = Omit<VV, Denied>
  type PV = Partial<V>
  type New = RORec<'new', ReadyForMerge>
  type Extra = Omit<EE, IdAndTsKeys | GID | keyof V>

  const doubleReplace = (x: RawStages<O, Replace<Out, PV>, Replace<Replace<Out, PV>, V>, New>) =>
    x as RawStages<O, Replace<Out, PV>, Replace<Out, V>, New>
  const sss: RawStages<O, Replace<Out, PV>, Replace<Out, V>, New> = doubleReplace(
    $set_<O, Replace<Out, PV>, Replace<Replace<Out, PV>, V>, New>(
      set<V>()(
        mapExact0<V, MappedHKT<V, DeltaAccumulatorHKT<T>>, Update<Replace<Out, PV>, V, New>>(
          args,
          (v, k) =>
            to(
              v.merge<Replace<Out, PV>, New>(
                root<O<PV>>().of(k).expr(),
                ctx<O<V>>()('new').of(k).expr(),
              ),
            ),
        ),
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
    _id: ['_id', to($rand)],
    touchedAt: ['touchedAt', to(now)],
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

  const updater: Updater<
    Replace<Out, PV>,
    Replace<Out, PV>,
    Replace<Replace<Out, PV>, V>,
    New
  > = set<V>()<Replace<Out, PV>, Replace<Out, PV>, New>(
    addExtraAndMerge as MapO<V, Update<Replace<Out, PV>, V, New>>,
  )

  const xx: RawStages<O, Replace<Out, PV>, Replace<Replace<Out, PV>, V>, New> = $set_(updater)

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
        $merge_<ReadyForMerge, Replace<Out, PV>, New>({
          stages: 'ctx',
          ...out,
          on: root<ReadyForMerge>().of(gid),
          vars: { new: ['new', root<ReadyForMerge>().expr()] },
          whenMatched: link<Replace<Out, PV>, New>()
            .with<O, Replace<Out, V>>(sss)
            .with<O, Replace<Out, V>>(doubleReplace(xx)).stages,
        }),
      ).stages
  )
}
