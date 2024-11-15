import type { App, HKT, I, ID, IdHKT, O, RORec, Rec, notArr } from '../../../../types'
import type { WriteonlyCollection } from '../../../../types/view'
import { field, mergeExpr, type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { $ifNull } from '../../../expression/logic'
import { $rand, now } from '../../../expression/val'
import { Field, ctx, root } from '../../../field'
import type { RawStages, TS } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { set, to, type Updater } from '../../../update'
import { excludeIdem, notExtendExcluded, omitRORec, type Equal } from '../../../utils/guard'
import { mapExact, type Exact } from '../../../utils/map-object'
import { $replaceWith_, $set_ } from '../../mongo-stages'
import { $merge_ } from '../../out'
import { link } from '../../prefix'
import { $set } from '../../set'

type GI<GG> = Exclude<GG, keyof TS>
type Not<GID> = No | GID
type No = keyof (TS & ID)
export const subMerge = <T extends O, Grp extends notArr, VV extends O, GG extends string>(
  args: DeltaAccumulators<T, Omit<VV, Not<GI<GG>>>>,
  out: WriteonlyCollection<TS & ID & Rec<GI<GG>, Grp> & Omit<VV, Not<GI<GG>>>>,
  gid: GI<GG>,
  addGrp: <F extends HKT>(
    ts: Exact<TS & ID, F>,
    gid: (gid: GI<GG>) => App<F, Grp>,
  ) => Exact<TS & ID & RORec<GI<GG>, Grp>, F>,
): RawStages<unknown, Rec<GI<GG>, Grp> & Omit<VV, Not<GI<GG>>>, 'out'> => {
  type GID = GI<GG>
  type V_Grp = Rec<GID, Grp> & V
  type Out = TS & ID & V_Grp
  type Denied = No | GID
  type V = Omit<VV, Denied>
  type Ctx = RORec<'new', Out>

  return link<V_Grp>()
    .with<unknown, Out>(
      set()(addGrp({ _id: ['_id', to($rand)] }, gid => to(root<Out>().of(gid).expr()))),
    )
    .with<unknown, 'out'>(
      $merge_<Out, Out, RORec<'new', Out>>({
        stages: 'ctx',
        into: out,
        on: root<Out>().of(gid),
        whenNotMatched: 'insert',
        vars: { new: ['new', root<Out>().expr()] },
        whenMatched: $set_(
          set()(
            mergeExpr<VV, TS & ID & RORec<GID, Grp>, Out, Ctx, O>(
              mapExact<V, DeltaAccumulatorHKT<T>, ExprHKT<Out, Ctx>>(args, (v, k) =>
                to(
                  v.sum<Out, Ctx>(
                    $ifNull(root<O<V>>().of(k).expr(), v.zero),
                    $ifNull(ctx<O<V>>()('new').of(k).expr(), v.zero),
                  ),
                ),
              ),
              addGrp(
                {
                  _id: ['_id', to(root<Out>().of('_id').expr())],
                  touchedAt: ['touchedAt', to(now)],
                },
                gid => to(root<Out>().of(gid).expr()),
              ),
            ),
          ),
        ),
      }),
    ).stages
}
