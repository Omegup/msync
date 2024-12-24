import type { RWCollection } from '../../../types'
import type { AsLiteral, ID, O, RORec, Rec, doc, notArr } from '../../../types/json'
import { mergeExpr, type ExprsExact, type ExprsExactHKT } from '../../expression/concat'
import { root } from '../../field'
import type { Delta, DeltaAccumulators, Expr, RawStages, TS } from '../../types'
import { omitPick } from '../../utils/guard'
import { map1 } from '../../utils/json'
import type { MergeInto } from '../out'
import { link } from '../prefix'
import { subGroup } from './utils/sub-group'
import { subMerge, type IdAndTsKeys, type Loose } from './utils/sub-merge'

type Denied<GID = never> = keyof (TS & ID) | GID
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

export const $groupMerge = <
  T extends O,
  Grp extends notArr,
  V extends O,
  GG extends string,
  EE = {},
  Out extends Loose<Grp, V, GG, EE> = Loose<Grp, V, GG, EE>,
>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, O & Omit<V, Denied<GI<GG>>>>,
  out: MergeInto<Loose<Grp, V, GG, EE>, Out>,
  gid: AsLiteral<GI<GG>>,
  extra: ExprsExact<
    Omit<EE, IdAndTsKeys | GI<GG> | keyof Omit<V, IdAndTsKeys | GI<GG>>>,
    Rec<GI<GG>, Grp> & Omit<V, IdAndTsKeys | GI<GG>>
  >,
): RawStages<unknown, Delta<T>, 'out'> => {
  return link<Delta<T>>()
    .with<unknown, WithGRP<Omit<V, Denied<GI<GG>>>, Grp, GI<GG>>>(
      subGroup<T, Grp, O & Omit<V, Denied<GI<GG>>>, GI<GG>>(id, args, addGrp<V, Grp, GI<GG>>(gid)),
    )
    .with<unknown, 'out'>(subMerge<T, Grp, V, GG, EE, Out>(args, out, gid, extra)).stages
}

export const $groupId = <
  T extends O,
  V extends O,
  EE = {},
  Out extends Loose<string, V, '_id', EE> = Loose<string, V, '_id', EE>,
>(
  id: Expr<string, T>,
  args: DeltaAccumulators<T, O & Omit<V, Denied>>,
  out: RWCollection<Out>,
  extra: ExprsExact<Omit<EE, IdAndTsKeys | keyof Omit<V, IdAndTsKeys>>, doc & Omit<V, IdAndTsKeys>>,
): RawStages<unknown, Delta<T>, 'out'> =>
  $groupMerge<T, string, V, '_id', EE, Out>(
    id,
    args,
    { into: out, whenNotMatched: 'fail' },
    '_id',
    extra,
  )

export const $group = <
  T extends O,
  Grp extends notArr,
  V extends O,
  EE = {},
  Out extends Loose<Grp, V, '_grp', EE> = Loose<Grp, V, '_grp', EE>,
>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, O & Omit<V, Denied<'_grp'>>>,
  out: RWCollection<Loose<Grp, V, '_grp', EE>, Out>,
  extra: ExprsExact<
    Omit<EE, IdAndTsKeys | '_grp' | keyof Omit<V, IdAndTsKeys | '_grp'>>,
    Rec<'_grp', Grp> & Omit<V, IdAndTsKeys | '_grp'>
  >,
): RawStages<unknown, Delta<T>, 'out'> =>
  $groupMerge(id, args, { into: out, whenNotMatched: 'insert' }, '_grp', extra)
