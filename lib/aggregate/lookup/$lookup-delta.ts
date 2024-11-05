import type { Arr, AsLiteral, ID, N, O, RORec, Rec } from '../../../types'
import { $filter } from '../../expression/array'
import { field, mergeExpr, type ExprsExactHKT } from '../../expression/concat'
import { eq } from '../../expression/logic'
import { Field, ctx, root } from '../../field'
import { $expr } from '../../predicate/$expr'
import { $or } from '../../query/logic'
import type { BA, Before, Delta, Expr, RawStages, TStages } from '../../types'
import { omitRORec } from '../../utils/guard'
import { map1 } from '../../utils/json'
import { $match_, $simpleLookup_ } from '../mongo-stages'
import { link } from '../prefix'
import { $replaceWithDelta, $replaceWithEach } from '../set'
import { $unwindDelta } from '../unwind'

type s = string
type Both<K1 extends s, LE, KK2 extends s, RE> = Delta<
  Rec<K1, LE> & Rec<Exclude<KK2, BA | K1>, RE> & ID
>

export const $lookupDelta = <
  LQ,
  LE extends LQ & O,
  RQ extends O,
  RE extends RQ,
  BRB extends Before<RQ>,
  RS,
  S,
  K1 extends s,
  KK2 extends s,
>(
  { field1, field2 }: { field1: Field<LQ, S>; field2: Field<RQ, S> },
  { coll, exec, input }: TStages<RS, Before<RQ>, BRB, Before<RE>>,
  k1: AsLiteral<K1>,
  k2: AsLiteral<Exclude<KK2, BA | K1 | K1>>,
  k: K1 | Exclude<KK2, BA | K1> | false,
): RawStages<unknown, Delta<LE>, Both<K1, LE, KK2, RE>> => {
  type K2 = Exclude<KK2, BA | K1>
  type BU = Before<RE>
  type DeltaS = RORec<BA, S | N>
  const f2: Expr<S, BRB> = root<BRB>().of('before').with(field2).expr()
  type Both<K extends BA> = Rec<K, Rec<K1, LE>> & Rec<K2, Arr<BU>>
  return link<Delta<LE>>()
    .with<unknown, Delta<Rec<K1, LE>>>(
      $replaceWithDelta<LE, Rec<K1, LE>>(field<RORec<K1, LE>, LE>(map1(k1, root<LE>().expr()))),
    )
    .with<unknown, Delta<Rec<K1, LE>> & Rec<K2, Arr<BU>>>(
      $simpleLookup_({
        coll,
        k: k2,
        vars: {
          after: ['after', root<Delta<Rec<K1, LE>>>().of('after').of(k1).with(field1).expr()],
          before: ['before', root<Delta<Rec<K1, LE>>>().of('before').of(k1).with(field1).expr()],
        },
        pipeline: link<RS, DeltaS>()
          .with(input)
          .with(
            $match_(
              $or(
                $expr(eq<S | N, BRB, DeltaS>(ctx<S | N>()('before').expr())(f2)),
                $expr(eq<S | N, BRB, DeltaS>(ctx<S | N>()('after').expr())(f2)),
              ),
            ),
          )
          .with(exec).stages,
      }),
    )
    .with(
      $replaceWithEach<Rec<K1, LE>, Rec<K1, LE> & Rec<K2, Arr<RE>>, Rec<K2, Arr<BU>>>(
        <K extends BA>(f: K): Expr<Rec<K1, LE> & Rec<K2, Arr<RE>>, Both<K>> => {
          const omit = omitRORec<KK2, BA, K1, Arr<RE>>()
          const a = $filter<RE, Both<K>, 'before'>({
            as: 'before',
            cond: eq<S | N, Both<K>, { readonly before: RE }>(
              ctx<RE>()('before').with(field2).expr(),
            )(root<Rec<K, Rec<K1, LE>>>().of(f).of(k1).with(field1).expr()),
            expr: root<Rec<K2, Arr<BU>>>().of(k2).of('before').expr(),
          })
          return field<RORec<K1, LE> & RORec<K2, Arr<RE>>, Both<K>>(
            omit.backward<ExprsExactHKT<RORec<K1, LE>, Both<K>>>(
              mergeExpr<RORec<K2, Arr<RE>>, RORec<K1, LE>, Both<K>>(
                omit.forward<ExprsExactHKT<{}, Both<K>>>(map1(k2, a)),
                map1(k1, root<Rec<K, Rec<K1, LE>>>().of(f).of(k1).expr()),
              ),
            ),
          )
        },
      ),
    )
    .with<unknown, Delta<Rec<K1, LE> & Rec<K2, RE> & ID>>($unwindDelta(k1, k2, k)).stages
}
