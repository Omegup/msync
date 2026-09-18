import crypto from 'crypto'
import type { Arr, AsLiteral, ID, N, O, RORec, Rec, doc, rawItem } from '../../../types'
import { field, mergeExpr, type ExprsExactHKT } from '../../expression/concat'
import { $ifNull, eq, ite } from '../../expression/logic'
import { nil, val } from '../../expression/val'
import { Field, root } from '../../field'
import type { BA, Before, Delta, Expr, RawStages, TStages, UBefore } from '../../types'
import { set, to } from '../../update'
import { omitRORec } from '../../utils/guard'
import { map1 } from '../../utils/json'
import { $set_, $simpleLookup_ } from '../mongo-stages'
import { link } from '../prefix'
import { canonicalize as str } from 'json-canonicalize'
import { $replaceWithEach, $replaceWithEach1 } from '../set/$replace-with-each'
import { $replaceWithDelta } from '../set/$set-delta'
import { $unwindDelta, type JoinId } from '../unwind'

type s = string
type Both<
  K1 extends s,
  LE,
  KK2 extends s,
  RE,
  N1 extends null = never,
  N2 extends null = never,
> = Delta<Rec<K1, LE | N1> & Rec<Exclude<KK2, BA | K1>, RE | N2> & ID>

export const $lookupDelta = <
  LQ extends O,
  LE extends LQ & doc,
  RQ extends O,
  RE extends RQ & doc,
  BRB extends UBefore<RQ>,
  RS extends UBefore<RQ>,
  S extends rawItem,
  K1 extends s,
  KK2 extends s,
  N1 extends null = never,
  N2 extends null = never,
>(
  { field1, field2 }: { field1: Field<LQ, S | N | Arr<S>>; field2: Field<RQ, S | N | Arr<S>> },
  { coll, exec, input }: TStages<RS, UBefore<RQ>, BRB, Before<RE>>,
  k1: AsLiteral<K1>,
  k2: AsLiteral<Exclude<KK2, BA | K1>>,
  k:
    | ([N1] extends [never] ? K1 : never)
    | ([N2] extends [never] ? Exclude<KK2, BA | K1> : never)
    | Exclude<JoinId<K1, Exclude<KK2, BA | K1>>, K1 | Exclude<KK2, BA | K1>>,
  includeNull1?: N1,
  includeNull2?: N2,
): RawStages<unknown, Delta<LE>, Both<K1, LE, KK2, RE, N1, N2>> => {
  type K2 = Exclude<KK2, BA | K1>
  type BU = Before<RE>
  const omit = omitRORec<KK2, BA, K1, Arr<RE>>()
  const hash = crypto.createHash('md5').update(coll.collectionName+str(input)+str(exec)).digest('base64url')

  type ABIds = Rec<'aId' | 'bId', S | Arr<S>>
  const ss = (f: BA) =>
    to($ifNull(root<Delta<Rec<K1, LE>>>().of(f).of(k1).with(field1).expr(), val<S | S>(hash as S)))
  return link<Delta<LE>>()
    .with<unknown, Delta<Rec<K1, LE>>>(
      $replaceWithDelta<LE, Rec<K1, LE>>(field<RORec<K1, LE>, LE>(map1(k1, root<LE>().expr()))),
    )
    .with<unknown, Delta<Rec<K1, LE>> & ABIds>(
      $set_<O, Delta<Rec<K1, LE>>, Delta<Rec<K1, LE>> & ABIds>(
        set<ABIds>()({ bId: ['bId', ss('before')], aId: ['aId', ss('after')] }),
      ),
    )
    .with<unknown, Delta<Rec<K1, LE>> & Rec<'a', Arr<BU>> & ABIds>(
      $simpleLookup_<Delta<Rec<K1, LE>> & ABIds, Before<RE>, RS, 'a', unknown, unknown, S | N>({
        coll,
        k: 'a',
        fields: {
          foreign: root<UBefore<RQ>>().of('before').with(field2),
          local: root<ABIds>().of('aId'),
        },
        vars: {},
        pipeline: link<RS>().with(input).with(exec).stages,
      }),
    )
    .with<unknown, Delta<Rec<K1, LE>> & Rec<'a' | 'b', Arr<BU>>>(
      $simpleLookup_<
        Delta<Rec<K1, LE>> & Rec<'a', Arr<BU>> & ABIds,
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
          local: root<ABIds>().of('bId'),
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
    .with<unknown, Delta<Rec<K1, LE | N1> & Rec<K2, Arr<RE>>>>(
      includeNull1 === null
        ? $replaceWithEach1<Rec<K1, LE> & Rec<K2, Arr<RE>>, Rec<K1, LE | N1> & Rec<K2, Arr<RE>>>(
            <K extends BA>(
              f: K,
            ): Expr<
              (Rec<K1, LE | N1> & Rec<K2, Arr<RE>>) | null,
              Delta<Rec<K1, LE> & Rec<K2, Arr<RE>>>
            > => {
              type R = Delta<Rec<K1, LE | N1> & Rec<K2, Arr<RE>>>
              type OtherField = Field<R, Exclude<R[BA], N>>
              const otherField = root<R>().of(f === 'after' ? 'before' : 'after')
              return $ifNull(
                root<R>().of(f).expr(),
                field<RORec<K1, LE | N1> & RORec<K2, Arr<RE>>, R>(
                  omit.backward<ExprsExactHKT<RORec<K1, LE | N1>, R>>(
                    mergeExpr<RORec<K2, Arr<RE>>, RORec<K1, LE | N>, R>(
                      omit.forward<ExprsExactHKT<{}, R>>(
                        map1(k2, (otherField as OtherField).of(k2).expr()),
                      ),
                      map1(k1, nil),
                    ),
                  ),
                ),
              )
            },
          )
        : link<Delta<Rec<K1, LE> & Rec<K2, Arr<RE>>>>().stages,
    )
    .with<unknown, Delta<Rec<K1, LE | N1> & Rec<K2, RE | N2> & ID>>(
      $unwindDelta<K1, LE, K2, RE, N1, N2>(k1, k2, k, includeNull1, includeNull2),
    ).stages
}
