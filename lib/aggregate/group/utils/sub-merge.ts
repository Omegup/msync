import type { Timestamp } from 'mongodb'
import type { HKT, I, ID, IdHKT, O, RORec, Rec } from '../../../../types'
import type { WriteonlyCollection } from '../../../../types/view'
import { field, mergeExpr, type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { $ifNull } from '../../../expression/logic'
import { $rand, now } from '../../../expression/val'
import { Field, ctx, root } from '../../../field'
import type { RawStages, TS } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { set, to, type Updater } from '../../../update'
import { notExtendExcluded, omitPick, omitRORec } from '../../../utils/guard'
import { mapExact } from '../../../utils/map-object'
import { $replaceWith_, $set_ } from '../../mongo-stages'
import { $merge_ } from '../../out'
import { link } from '../../prefix'

type GID = '_grp'
type Denied = keyof (TS & ID) | GID
const gid: GID = '_grp'

export const subMerge = <T extends O, Grp, VV extends O>(
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
  const addTS = <V extends O, Out extends O>(patch: Updater<V, V, Out>) =>
    $set_<unknown, V, Out>(patch)

  const replaceWithOut = <Out extends O>(
    x: ExprsExact<Out, Out, RORec<'new', Out>, IdHKT>,
    out: WriteonlyCollection<Out>,
    on: Field<Out, Grp, unknown>,
  ) =>
    $merge_<Out, Out, RORec<'new', Out>>({
      stages: 'ctx',
      into: out,
      on,
      whenNotMatched: 'insert',
      vars: { new: ['new', root<Out>().expr()] },
      whenMatched: $replaceWith_(field(x)),
    })
  interface GetFromVHKT extends HKT<keyof (Rec<'_grp', Grp> & Omit<VV, Denied>)> {
    readonly out: (Rec<'_grp', Grp> & Omit<VV, Denied>)[I<
      keyof (Rec<'_grp', Grp> & Omit<VV, Denied>),
      this
    >]
  }

  const eq = <K extends Denied>() =>
    notExtendExcluded<K, keyof O | '_grp', keyof VV, Denied, GetFromVHKT, undefined>()
  interface UpdaterOutF<T> extends HKT {
    readonly out: Updater<unknown, I<unknown, this>, T>
  }

  return link<Rec<GID, Grp> & V>()
    .with<unknown, Out>(
      addTS(
        omit2.backward<UpdaterF<Rec<Exclude<GID, keyof (TS & ID)>, Grp>>>(
          omit1.forward<UpdaterF<Omit<Omit<VV, Denied>, keyof (TS & ID)>>>(
            set<TS & ID>()<Rec<GID, Grp> & V, Rec<GID, Grp> & V>({
              touchedAt: ['touchedAt', eq<'touchedAt'>().backward<UpdaterOutF<Timestamp>>(to(now))],
              _id: ['_id', eq<'_id'>().backward<UpdaterOutF<string>>(to($rand))],
            }),
          ),
        ),
      ),
    )
    .with<unknown, 'out'>(
      replaceWithOut(
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
        out,
        root<Out>().of(gid),
      ),
    ).stages
}
