import type { RWCollection, WriteonlyCollection } from '../../../types'
import type { AsLiteral, ID, O, RORec, Rec, Replace, doc, notArr } from '../../../types/json'
import { mergeExpr, type ExprsExact, type ExprsExactHKT } from '../../expression/concat'
import { root } from '../../field'
import type { Delta, DeltaAccumulators, Expr, StreamRunnerParam, TS } from '../../types'
import { omitPick } from '../../utils/guard'
import { map1 } from '../../utils/json'
import { mapExactToObject } from '../../utils/map-object'
import type { MergeInto } from '../out'
import { link } from '../prefix'
import { subGroup } from './utils/sub-group'
import {
  subMerge,
  type Extra,
  type IdAndTsKeys,
  type Loose,
  type Strict,
  type V_Grp,
} from './utils/sub-merge'

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
  Out extends Loose<Grp, V, GG> = Loose<Grp, V, GG>,
>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, O & Omit<V, Denied<GI<GG>>>>,
  out: MergeInto<
    Strict<Grp, V, GG, EE>,
    Out,
    WriteonlyCollection<Replace<Out, Strict<Grp, V, GG, EE>>>
  >,
  gid: AsLiteral<GI<GG>>,
  extra: ExprsExact<Extra<EE, V, GG>, V_Grp<V, GG, Grp>>,
  idPrefix = '',
): StreamRunnerParam<Delta<T>, 'out'> => ({
  raw: (first: boolean) =>
    link<Delta<T>>()
      .with<unknown, WithGRP<Omit<V, Denied<GI<GG>>>, Grp, GI<GG>>>(
        subGroup<T, Grp, O & Omit<V, Denied<GI<GG>>>, GI<GG>>(
          id,
          args,
          addGrp<V, Grp, GI<GG>>(gid),
        ),
      )
      .with<unknown, 'out'>(
        subMerge<T, Grp, V, GG, EE, Out>(args, out, gid, extra, idPrefix, first),
      ).stages,
  teardown: c =>
    c(
      out.whenNotMatched === 'insert'
        ? {
            collection: out.into,
            method: 'deleteMany',
            params: [{}],
          }
        : {
            collection: out.into,
            method: 'updateMany',
            params: [
              {},
              [
                {
                  $unset: Object.keys({
                    ...mapExactToObject(extra, () => 1),
                    ...mapExactToObject(args, () => 1),
                  }),
                },
              ],
            ],
          },
    ),
})
export const $groupId = <
  T extends O,
  V extends O,
  EE = {},
  Out extends Loose<string, V, '_id'> = Loose<string, V, '_id'>,
>(
  id: Expr<string, T>,
  args: DeltaAccumulators<T, O & Omit<V, Denied>>,
  out: RWCollection<Replace<Out, Strict<string, V, '_id', EE>>, Out>,
  extra: ExprsExact<Omit<EE, IdAndTsKeys | keyof Omit<V, IdAndTsKeys>>, doc & Omit<V, IdAndTsKeys>>,
): StreamRunnerParam<Delta<T>, 'out'> =>
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
  Out extends Loose<Grp, V, '_grp'> = Loose<Grp, V, '_grp'>,
>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, O & Omit<V, Denied<'_grp'>>>,
  out: RWCollection<Strict<Grp, V, '_grp', EE>, Out>,
  extra: ExprsExact<
    Omit<EE, IdAndTsKeys | '_grp' | keyof Omit<V, IdAndTsKeys | '_grp'>>,
    Rec<'_grp', Grp> & Omit<V, IdAndTsKeys | '_grp'>
  >,
  idPrefix = '',
): StreamRunnerParam<Delta<T>, 'out'> =>
  $groupMerge(id, args, { into: out, whenNotMatched: 'insert' }, '_grp', extra, idPrefix)
