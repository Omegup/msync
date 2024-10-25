import type { HKT, I, ID, J, O, RORec, Rec, jsonItem } from '../../../../types'
import type { WriteonlyCollection } from '../../../../types/view'
import { field, mergeExpr, type ExprHKT } from '../../../expression/concat'
import { $ifNull } from '../../../expression/logic'
import { $rand, now } from '../../../expression/val'
import { ctx, root } from '../../../field'
import type { RawStages, TS } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { set, to, type Updater } from '../../../update'
import { omitPick, omitRORec } from '../../../utils/guard'
import { mapExact } from '../../../utils/map-object'
import { $replaceWith_, $set_ } from '../../mongo-stages'
import { $merge_ } from '../../out'
import { link } from '../../prefix'

type GID = '_grp'
type Denied = keyof (TS & ID) | GID
const gid: GID = '_grp'

export const subMerge = <T extends J, Grp extends jsonItem, VV extends RORec<string, jsonItem>>(
  args: DeltaAccumulators<T, Omit<VV, Denied>>,
  out: WriteonlyCollection<TS & ID & Rec<GID, Grp> & Omit<VV, Denied>>,
): RawStages<unknown, Rec<GID, Grp> & Omit<VV, Denied>, 'out'> => {
  type Out = TS & ID & Rec<GID, Grp> & V
  type V = Omit<VV, Denied>
  const omit1 = omitRORec<GID, never, keyof (TS & ID), Grp>()
  const omit2 = omitPick<keyof VV, GID, keyof (TS & ID), VV>()
  type Ctx = RORec<'new', Out>
  interface UpdaterF<E> extends HKT {
    readonly out: Updater<Rec<GID, Grp> & V, Rec<GID, Grp> & V, O & TS & ID & E & I<unknown, this>>
  }
  return link<Rec<GID, Grp> & V>()
    .with<unknown, Out>(
      $set_<unknown, Rec<GID, Grp> & V, Out>(
        omit2.backward<UpdaterF<Rec<Exclude<GID, keyof (TS & ID)>, Grp>>>(
          omit1.forward<UpdaterF<Omit<Omit<VV, Denied>, keyof (TS & ID)>>>(
            set({
              touchedAt: ['touchedAt', to(now)],
              _id: ['_id', to($rand)],
            }),
          ),
        ),
      ),
    )
    .with<unknown, 'out'>(
      $merge_<Out, Out, { readonly new: Out }>({
        stages: 'ctx',
        into: out,
        on: root<Rec<GID, Grp>>().of(gid),
        whenNotMatched: 'insert',
        vars: { new: ['new', root<Out>().expr()] },
        whenMatched: link<Out, { readonly new: Out }>().with<unknown, Out>(
          $replaceWith_(
            field<Out, Out, Ctx>(
              mergeExpr<VV, TS & ID & RORec<GID, Grp>, Out, Ctx, O>(
                mapExact<V, DeltaAccumulatorHKT<T>, ExprHKT<Out, Ctx>>(args, (v, k) =>
                  v.sum<Out, Ctx>(
                    $ifNull(root<O<V>>().of(k).expr(), v.zero),
                    $ifNull(ctx<O<V>>()('new').of(k).expr(), v.zero),
                  ),
                ),
                {
                  _grp: ['_grp', root<Out>().of('_grp').expr()],
                  _id: ['_id', root<Out>().of('_id').expr()],
                  touchedAt: ['touchedAt', now],
                },
              ),
            ),
          ),
        ).stages,
      }),
    ).stages
}
