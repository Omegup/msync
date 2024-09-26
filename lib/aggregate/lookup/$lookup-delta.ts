import type { Arr, ID, J, N, RORec, Rec, doc } from '../../../types'
import { $filter } from '../../expression/array'
import { field } from '../../expression/concat'
import { eq } from '../../expression/logic'
import { Field, ctx, root } from '../../field'
import { $expr } from '../../predicate/$expr'
import { $or } from '../../query/logic'
import type { BA, Before, Delta, Expr, RawStages, TStages } from '../../types'
import { map1 } from '../../utils/json'
import { $match_, $simpleLookup_ } from '../mongo-stages'
import { link } from '../prefix'
import { $replaceWithDelta, $replaceWithEach } from '../set'
import { $unwindDelta } from '../unwind'

type s = string
export const $lookupDelta = <
  LQ,
  LE extends LQ & J,
  RQ extends J,
  RE extends RQ & doc,
  BRB extends Before<RQ>,
  RS,
  S,
  KK1 extends s,
  KK2 extends s,
>(
  { field1, field2 }: { field1: Field<LQ, S>; field2: Field<RQ, S> },
  { coll, exec, input }: TStages<RS, Before<RQ>, BRB, Before<RE>>,
  k1: Exclude<KK1, BA>,
  k2: Exclude<KK2, BA>,
): RawStages<
  unknown,
  Delta<LE>,
  Delta<Rec<Exclude<KK1, BA>, LE> & Rec<Exclude<KK2, BA>, RE> & ID>
> => {
  type K1 = Exclude<KK1, BA>
  type K2 = Exclude<KK2, BA>
  type BU = Before<RE>
  type DeltaS = RORec<BA, S | N>
  const f2: Expr<S, BRB> = root<BRB>().of('before').with(field2).expr()
  return link<Delta<LE>>()
    .with<unknown, Delta<Rec<K1, LE>>>(
      $replaceWithDelta<unknown, LE, Rec<K1, LE>>(field(map1(k1, root<LE>().expr()))),
    )
    .with<unknown, Delta<Rec<K1, LE>> & Rec<K2, Arr<BU>>>(
      $simpleLookup_({
        coll,
        k: k2,
        vars: {
          after: root<Delta<Rec<K1, LE>>>().of('after').of(k1).with(field1).expr(),
          before: root<Delta<Rec<K1, LE>>>().of('before').of(k1).with(field1).expr(),
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
          .with(exec)
          .stages,
      }),
    )
    .with<unknown, Delta<Rec<K1, LE> & Rec<K2, Arr<RE>>>>(
      $replaceWithEach<unknown, Rec<K1, LE>, Rec<K1, LE> & Rec<K2, Arr<RE>>, Rec<K2, Arr<BU>>>(
        <K extends BA>(
          f: K,
        ): Expr<Rec<K1, LE> & Rec<K2, Arr<RE>>, Rec<K, Rec<K1, LE>> & Rec<K2, Arr<BU>>> => {
          return field<RORec<K1, LE> & RORec<K2, Arr<RE>>, Rec<K, Rec<K1, LE>> & Rec<K2, Arr<BU>>>(
            Object.fromEntries([
              [k1, root<Rec<K, Rec<K1, LE>>>().of(f).of(k1).expr()],
              [
                k2,
                $filter<RE, Rec<K, Rec<K1, LE>> & Rec<K2, Arr<BU>>, 'before'>({
                  as: 'before',
                  cond: eq<S | N, Rec<K, Rec<K1, LE>> & Rec<K2, Arr<BU>>, { readonly before: RE }>(
                    ctx<RE>()('before').with(field2).expr(),
                  )(root<Rec<K, Rec<K1, LE>>>().of(f).of(k1).with(field1).expr()),
                  expr: root<Rec<K2, Arr<BU>>>().of(k2).of('before').expr(),
                }),
              ],
            ]),
          )
        },
      ),
    )
    .with<unknown, Delta<Rec<K1, LE> & Rec<K2, RE> & ID>>($unwindDelta(k1, k2)).stages
}
