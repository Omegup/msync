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

type GI<GG> = Exclude<GG, No>
type Not<GID> = No | GID
type No = keyof (TS & ID)
export const subMerge = <T extends O, Grp extends notArr, VV extends O, GG extends string>(
  args: DeltaAccumulators<T, Omit<VV, Not<GI<GG>>>>,
  out: WriteonlyCollection<TS & ID & Rec<GI<GG>, Grp> & Omit<VV, Not<GI<GG>>>>,
  gid: GI<GG>,
  group: <F extends HKT>(
    ts: Exact<TS & ID, F>,
    gid: (gid: GI<GG>) => App<F, Grp>,
  ) => Exact<TS & ID & RORec<GI<GG>, Grp>, F>,
): RawStages<unknown, Rec<GI<GG>, Grp> & Omit<VV, Not<GI<GG>>>, 'out'> => {
  type GID = GI<GG>
  type Out = TS & ID & Rec<GID, Grp> & V
  type Denied = No | GID
  type V = Omit<VV, Denied>
  type Ctx = RORec<'new', Out>

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
  interface GetFromVHKT extends HKT<keyof (Rec<GID, Grp> & V)> {
    readonly out: (Rec<GID, Grp> & V)[I<keyof (Rec<GID, Grp> & V), this>]
  }

  const eq = <K extends Denied>(): Equal<
    unknown,
    K extends (keyof O | GID) | Exclude<keyof VV, Denied | K> ? App<GetFromVHKT, K> : undefined,
    K extends keyof O | GID ? App<GetFromVHKT, K> : undefined
  > => notExtendExcluded<K, keyof O | GID, keyof VV, Denied, GetFromVHKT, undefined>()
  interface UpdaterTF<V> extends HKT {
    readonly out: Updater<unknown, I<unknown, this>, V>
  }
  type UpdaterT<E> = Updater<Rec<GID, Grp> & V, Rec<GID, Grp> & V, O & TS & ID & E>
  interface UpdaterVF<E> extends HKT {
    readonly out: UpdaterT<E & I<unknown, this>>
  }
  interface UpdaterKF extends HKT<keyof VV> {
    readonly out: UpdaterT<RORec<GID, Grp> & Pick<VV, I<keyof VV, this>>>
  }

  const patch = set<TS & ID>()<Rec<GID, Grp> & V, Rec<GID, Grp> & V>({
    touchedAt: ['touchedAt', to(now)],
    _id: ['_id', eq<'_id'>().backward<UpdaterTF<string>>(to($rand))],
  })

  const addTS = <V extends O, Out extends O>(patch: Updater<V, V, Out>) =>
    $set_<unknown, V, Out>(patch)

  const omit1 = omitRORec<GG, never, No, Grp>()
  const exclude = excludeIdem<keyof VV, No | GID, No>()
  return link<Rec<GID, Grp> & V>()
    .with<unknown, Out>(
      addTS<Rec<GID, Grp> & V, TS & ID & Rec<GID, Grp> & V>(
        exclude.backward<UpdaterKF>(omit1.backward<UpdaterVF<Omit<V, No>>>(patch)),
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
          group(
            {
              _id: ['_id', root<Out>().of('_id').expr()],
              touchedAt: ['touchedAt', now],
            },
            gid => root<Out>().of(gid).expr(),
          ),
        ),
        out,
        root<Out>().of(gid),
      ),
    ).stages
}
