import crypto from 'crypto'
import { canonicalize as str } from 'json-canonicalize'
import type {
  App,
  Arr,
  AsLiteral,
  Exclude,
  HKT,
  I,
  ID,
  N,
  O,
  Omit,
  RORec,
  Rec,
  doc,
  notArr,
} from '../../../types'
import { field, mergeExpr } from '../../expression/concat'
import { asExpr } from '../../expression/expr-base'
import { $ifNull, eqTyped, ite } from '../../expression/logic'
import { nil, val } from '../../expression/val'
import { Field, root } from '../../field'
import type { BA, Before, Delta, Expr, RawStages, TStages, UBefore } from '../../types'
import { set, to } from '../../update'
import { literalsEqaul } from '../../utils/guard'
import { map1 } from '../../utils/json'
import { $set_, $simpleLookup_ } from '../mongo-stages'
import { link } from '../prefix'
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
  S extends notArr,
  K1 extends s,
  KK2 extends s,
  N1 extends null = never,
  N2 extends null = never,
>(
  { field1, field2 }: { field1: Field<LQ, S | N | Arr<S>>; field2: Field<RQ, S | N | Arr<S>> },
  { coll, exec, input }: TStages<RS, UBefore<RQ>, BRB, Before<RE>>,
  k1: AsLiteral<K1>,
  k2: AsLiteral<Exclude<KK2, BA | K1>>,
  k: JoinId<K1, Exclude<KK2, BA | K1>>,
  includeNull1?: N1,
  includeNull2?: N2,
): RawStages<unknown, Delta<LE>, Both<K1, LE, KK2, RE, N1, N2>> => {
  type K2 = Exclude<KK2, BA | K1>
  type BU = Before<RE>
  const hash = crypto
    .createHash('md5')
    .update(coll.collectionName + str(input) + str(exec))
    .digest('base64url')

  type ABIds = Rec<'aId' | 'bId', S | Arr<S>>
  type In = Delta<Rec<K1, LE>>
  const normForeignKey = (f: BA) =>
    to(
      $ifNull(
        root<In>().of(f).of<Rec<K1, LE>, K1, null, 3>(k1).with(field1).expr(),
        asExpr<S, unknown>(val(hash)),
      ),
    )
  return link<Delta<LE>>()
    .with<unknown, Delta<Rec<K1, LE>>>(
      $replaceWithDelta<LE, Rec<K1, LE>>(field<RORec<K1, LE>, LE>(map1(k1, root<LE>().expr()))),
    )
    .with<unknown, Delta<Rec<K1, LE>> & ABIds>(
      $set_<O, Delta<Rec<K1, LE>>, Delta<Rec<K1, LE>> & ABIds>(
        set<ABIds>()({
          bId: ['bId', normForeignKey('before')],
          aId: ['aId', normForeignKey('after')],
        }),
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
          type R = Delta<Rec<K1, LE>> & Rec<'a' | 'b', Arr<BU>>
          type Side = Rec<K1, LE> | null
          type Row = (Rec<K1, LE> & Rec<K2, Arr<RE>>) | null
          const joined = <S extends 'before' | 'after', A extends 'a' | 'b'>(
            side: S,
            arr: A,
          ): Expr<Row, Omit<R, S> & Rec<S, Side>> => {
            type At<X extends Side> = Omit<R, S> & Rec<S, X>
            interface AtF extends HKT<Side> {
              readonly out: At<I<Side, this>>
            }
            type Present = At<Rec<K1, LE>>
            const here = root<Present>()
            return ite<Row, null, Rec<K1, LE>, AtF>(
              eqTyped<null, Rec<K1, LE>, AtF, unknown, Side>(
                root<App<AtF, Side>>().of<RORec<S, Side>, S, 1>(side).expr(),
                nil,
              ),
              nil,
              field<RORec<K1, LE> & RORec<K2, Arr<RE>>, Present>(
                mergeExpr<RORec<K2, Arr<RE>>, RORec<K1, LE>, Present>(
                  map1(k2, here.of<RORec<A, Arr<BU>>, A, 1>(arr).of<BU, 'before'>('before').expr()),
                  map1(
                    k1,
                    here.of<RORec<S, Rec<K1, LE>>, S, 1>(side).of<RORec<K1, LE>, K1, 1>(k1).expr(),
                  ),
                ),
              ),
            )
          }
          return f === 'after' ? joined('after', 'a') : joined('before', 'b')
        },
      ),
    )
    .with<unknown, Delta<Rec<K1, LE | N1> & Rec<K2, Arr<RE>>>>(
      includeNull1 === null
        ? $replaceWithEach1<Rec<K1, LE> & Rec<K2, Arr<RE>>, Rec<K1, LE | N1> & Rec<K2, Arr<RE>>>(
            <Part extends BA>(
              part: Part,
            ): Expr<
              (Rec<K1, LE | N1> & Rec<K2, Arr<RE>>) | null,
              Delta<Rec<K1, LE> & Rec<K2, Arr<RE>>>
            > => {
              type R1 = Rec<K1, LE> & Rec<K2, Arr<RE>>
              type R = Delta<R1>
              const otherPart: Field<R, R1 | null> = root<R>().of(
                part === 'after' ? 'before' : 'after',
              )

              interface NullK1 extends HKT<null> {
                readonly out: Expr<I<null, this>, R>
              }
              const n1 = literalsEqaul<null, N1>(includeNull1).forward<NullK1>(nil)
              const expr: Expr<
                (Rec<K1, LE | N1> & Rec<K2, Arr<RE>>) | null,
                Delta<Rec<K1, LE> & Rec<K2, Arr<RE>>>
              > = $ifNull<Rec<K1, LE | N1> & Rec<K2, Arr<RE>>, R, unknown>(
                root<R>().of(part).expr(),
                field<RORec<K1, LE | N1> & RORec<K2, Arr<RE>>, R>(
                  mergeExpr<RORec<K2, Arr<RE>>, RORec<K1, N1>, R>(
                    map1(k2, (otherPart as Field<R, R1>).of(k2).expr()),
                    map1(k1, n1),
                  ),
                ),
              )
              return expr
            },
          )
        : link<Delta<Rec<K1, LE> & Rec<K2, Arr<RE>>>>().stages,
    )
    .with<unknown, Delta<Rec<K1, LE | N1> & Rec<K2, RE | N2> & ID>>(
      $unwindDelta<K1, LE, KK2, RE, N1, N2>(k1, k2, k, includeNull1, includeNull2),
    ).stages
}
