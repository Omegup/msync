import type { HKT, I, ID, J, O, RORec, Rec, WriteonlyCollection, jsonItem } from '../../../types'
import { mergeExpr, type ExprsExact, type ExprsExactHKT } from '../../expression/concat'
import { root } from '../../field'
import type { Delta, Expr, RawStages, TS } from '../../types'
import type { DeltaAccumulators } from '../../types/accumulator'
import { omitPick } from '../../utils/guard'
import { map1 } from '../../utils/json'
import { link } from '../prefix'
import { subGroup, type WithGRP } from './utils/sub-group'
import { subMerge } from './utils/sub-merge'

type GID = '_grp'
const gid: GID = '_grp'
type Denied = keyof (TS & ID) | GID

const addGrp = <
  VV extends RORec<string, jsonItem>,
  D extends Rec<'_id', Grp>,
  Grp extends jsonItem,
>(
  expr: ExprsExact<Omit<VV, Denied>, D>,
): ExprsExact<RORec<GID, Grp> & Omit<VV, Denied>, D> => {
  const omit = omitPick<keyof VV, Denied, GID, VV>()
  return omit.backward<ExprsExactHKT<RORec<GID, Grp>, D>>(
    mergeExpr<Omit<VV, Denied>, RORec<GID, Grp>, D, unknown, O>(
      omit.forward<ExprsExactHKT<unknown, D>>(expr),
      map1(gid, root<D>().of('_id').expr()),
    ),
  )
}

export const $groupMerge = <
  Q extends J,
  T extends Q,
  Grp extends jsonItem,
  V extends Rec<string, jsonItem>,
>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, Omit<V, Denied>>,
  out: WriteonlyCollection<TS & ID & Rec<GID, Grp> & Omit<V, Denied>>,
): RawStages<unknown, Delta<T>, 'out'> =>
  link<Delta<T>>()
    .with<unknown, WithGRP<Omit<V, Denied>, Grp>>(
      subGroup<T, Grp, Omit<V, Denied>>(id, args, addGrp),
    )
    .with<unknown, 'out'>(subMerge<T, Grp, V>(args, out)).stages
