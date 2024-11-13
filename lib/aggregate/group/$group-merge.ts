import type { App, HKT, WriteonlyCollection } from '../../../types'
import type { AsLiteral, ID, O, RORec, Rec, notArr } from '../../../types/json'
import { mergeExpr, type ExprsExact, type ExprsExactHKT } from '../../expression/concat'
import { root } from '../../field'
import type { Delta, DeltaAccumulators, Expr, RawStages, TS } from '../../types'
import { omitPick } from '../../utils/guard'
import { map1 } from '../../utils/json'
import type { Exact } from '../../utils/map-object'
import { link } from '../prefix'
import { subGroup } from './utils/sub-group'
import { subMerge } from './utils/sub-merge'

type Denied<GID> = keyof (TS & ID) | GID
type WithGRP<V, Grp, GID extends string> = Rec<GID, Grp> & V
const addGrp =
  <V extends O, Grp, GID extends string>(gid: AsLiteral<GID>) =>
  <D extends Rec<'_id', Grp>>(
    expr: ExprsExact<O & Omit<V, Denied<GID>>, D>,
  ): ExprsExact<Rec<GID, Grp> & Omit<V, Denied<GID>>, D> => {
    const omit = omitPick<keyof V, Denied<GID>, GID, V>()
    return omit.backward<ExprsExactHKT<Rec<GID, Grp>, D>>(
      mergeExpr<Omit<V, Denied<GID>>, RORec<GID, Grp>, D, unknown, O>(
        omit.forward<ExprsExactHKT<unknown, D>>(expr),
        map1(gid, root<D>().of('_id').expr()),
      ),
    )
  }
type GI<GG> = Exclude<GG, keyof TS>

export const $groupMerge = <T extends O, Grp extends notArr, V extends O, GG extends string>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, O & Omit<V, Denied<GI<GG>>>>,
  out: WriteonlyCollection<TS & ID & Rec<GI<GG>, Grp> & Omit<V, Denied<GI<GG>>>>,
  gid: AsLiteral<GI<GG>>,
  group: <F extends HKT>(
    ts: Exact<TS & ID, F>,
    gid: (gid: GI<GG>) => App<F, Grp>,
  ) => Exact<TS & ID & RORec<GI<GG>, Grp>, F>,
): RawStages<unknown, Delta<T>, 'out'> => {
  type GID = GI<GG>

  return link<Delta<T>>()
    .with<unknown, WithGRP<Omit<V, Denied<GID>>, Grp, GID>>(
      subGroup<T, Grp, O & Omit<V, Denied<GID>>, GID>(id, args, addGrp<V, Grp, GID>(gid)),
    )
    .with<unknown, 'out'>(subMerge<T, Grp, V, GG>(args, out, gid, group)).stages
}

