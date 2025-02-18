import type { Arr, AsLiteral, ID, N, O, RORec, Rec } from '../../../types'
import { field, mergeExpr, type ExprsExactHKT } from '../../expression/concat'
import { eq, ite } from '../../expression/logic'
import { nil } from '../../expression/val'
import { Field, root } from '../../field'
import type { BA, Before, Delta, Expr, RawStages, TStages, UBefore } from '../../types'
import { omitRORec } from '../../utils/guard'
import { map1 } from '../../utils/json'
import { $simpleLookup_ } from '../mongo-stages'
import { link } from '../prefix'
import { $replaceWithDelta } from '../set/$set-delta'
import { $replaceWithEach } from '../set/$replace-with-each'
import { $unwindDelta } from '../unwind'

type s = string
type Both<K1 extends s, LE, KK2 extends s, RE> = Delta<
  Rec<K1, LE> & Rec<Exclude<KK2, BA | K1>, RE> & ID
>

export const $lookupDelta = <
  LQ extends O,
  LE extends LQ & O,
  RQ extends O,
  RE extends RQ,
  BRB extends UBefore<RQ>,
  RS extends UBefore<RQ>,
  S,
  K1 extends s,
  KK2 extends s,
>(
  { field1, field2 }: { field1: Field<LQ, S | N>; field2: Field<RQ, S | N> },
  { coll, exec, input }: TStages<RS, UBefore<RQ>, BRB, Before<RE>>,
  k1: AsLiteral<K1>,
  k2: AsLiteral<Exclude<KK2, BA | K1>>,
  k: K1 | Exclude<KK2, BA | K1> | false,
): RawStages<unknown, Delta<LE>, Both<K1, LE, KK2, RE>> => {
  type K2 = Exclude<KK2, BA | K1>
  type BU = Before<RE>

  return link<Delta<LE>>()
    .with<unknown, Delta<Rec<K1, LE>>>(
      $replaceWithDelta<LE, Rec<K1, LE>>(field<RORec<K1, LE>, LE>(map1(k1, root<LE>().expr()))),
    )
    .with<unknown, Delta<Rec<K1, LE>> & Rec<'a', Arr<BU>>>(
      $simpleLookup_<Delta<Rec<K1, LE>>, Before<RE>, RS, 'a', unknown, unknown, S | N>({
        coll,
        k: 'a' as const,
        fields: {
          foreign: root<UBefore<RQ>>().of('before').with(field2),
          local: root<Delta<Rec<K1, LE>>>().of('after').of(k1).with(field1),
        },
        vars: {},
        pipeline: link<RS>().with(input).with(exec).stages,
      }),
    )
    .with<unknown, Delta<Rec<K1, LE>> & Rec<'a' | 'b', Arr<BU>>>(
      $simpleLookup_<
        Delta<Rec<K1, LE>> & Rec<'a', Arr<BU>>,
        Before<RE>,
        RS,
        'b',
        unknown,
        unknown,
        S | N
      >({
        coll,
        k: 'b' as const,
        fields: {
          foreign: root<UBefore<RQ>>().of('before').with(field2),
          local: root<Delta<Rec<K1, LE>>>().of('before').of(k1).with(field1),
        },
        vars: {},
        pipeline: link<RS>().with(input).with(exec).stages,
      }),
    )
    .with<unknown, Delta<Rec<K1, LE> & Rec<K2, Arr<RE>>>>(
      $replaceWithEach<Rec<K1, LE>, Rec<K1, LE> & Rec<K2, Arr<RE>>, Rec<'a' | 'b', Arr<BU>>>(
        <K extends BA>(
          f: K,
        ): Expr<
          (Rec<K1, LE> & Rec<K2, Arr<RE>>) | null,
          Delta<Rec<K1, LE>> & Rec<'a' | 'b', Arr<BU>>
        > => {
          const f1 = f === 'after' ? 'a' : 'b'
          type R = Delta<Rec<K1, LE>> & Rec<'a' | 'b', Arr<BU>>
          const omit = omitRORec<KK2, BA, K1, Arr<RE>>()
          const a = root<R>().of(f1).of('before').expr()

          const part: Field<Delta<Rec<K1, LE>>, Rec<K1, LE> | N> = root<Delta<Rec<K1, LE>>>().of(f)

          return ite(
            eq(root<R>().of(f).expr())(nil),
            nil,
            field<RORec<K1, LE> & RORec<K2, Arr<RE>>, R>(
              omit.backward<ExprsExactHKT<RORec<K1, LE>, R>>(
                mergeExpr<RORec<K2, Arr<RE>>, RORec<K1, LE | N>, R>(
                  omit.forward<ExprsExactHKT<{}, R>>(map1(k2, a)),
                  map1(k1, part.of(k1).expr()),
                ),
              ),
            ),
          )
        },
      ),
    )
    .with<unknown, Delta<Rec<K1, LE> & Rec<K2, RE> & ID>>($unwindDelta(k1, k2, k)).stages
}
