import type { Arr, JsonObj, N, RORec, Rec, doc } from '../../types'
import { $filter } from '../expression/array'
import { field } from '../expression/concat'
import { eq } from '../expression/logic'
import { ctx } from '../expression/val'
import { Field, root } from '../field'
import { $expr } from '../predicate/$expr'
import { $or } from '../query/logic'
import type { BA, Before, Delta, Expr, RawStages, TStages } from '../types'
import { map1 } from '../utils/json'
import { $replaceWithDelta, $replaceWithEach } from './$replace-with-each'
import { $unwindDelta } from './$unwind-delta'
import { $match_, $simpleLookup_ } from './mongo-stages'
import { concatStages, link } from './prefix'

type s = string
export const $lookupDelta = <T extends JsonObj, U extends doc, R, S, K1 extends s, K2 extends s>(
  { field1, field2 }: { field1: Field<T, S>; field2: Field<U, S> },
  { stages, coll }: TStages<R, Before<U>>,
  k1: K1,
  k2: K2,
): RawStages<Delta<T>, Delta<Rec<K1, T> & Rec<K2, U>>> => {
  type BU = Before<U>
  type DeltaS = RORec<BA, S | N>
  const f2: Expr<S, BU> = root<BU>().of('before').of(field2)
  return link<Delta<T>>()
    .with<Delta<Rec<K1, T>>>($replaceWithDelta<T, Rec<K1, T>>(field(map1(k1, root()))))
    .with<Delta<Rec<K1, T>> & Rec<K2, Arr<BU>>>(
      $simpleLookup_({
        coll,
        k: k2,
        vars: {
          after: root<Delta<Rec<K1, T>>>().of('after').of(k1).of(field1),
          before: root<Delta<Rec<K1, T>>>().of('before').of(k1).of(field1),
        },
        pipeline: concatStages(
          stages,
          $match_(
            $or(
              $expr(eq<S | N, BU, DeltaS>(ctx('before'))(f2)),
              $expr(eq<S | N, BU, DeltaS>(ctx('after'))(f2)),
            ),
          ),
        ),
      }),
    )
    .with<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>>(
      $replaceWithEach<Rec<K1, T>, Rec<K1, T> & Rec<K2, Arr<U>>, Rec<K2, Arr<BU>>>(
        <K extends BA>(
          f: K,
        ): Expr<Rec<K1, T> & Rec<K2, Arr<U>>, Rec<K, Rec<K1, T>> & Rec<K2, Arr<BU>>> => {
          return field<RORec<K1, T> & RORec<K2, Arr<U>>, Rec<K, Rec<K1, T>> & Rec<K2, Arr<BU>>>(
            Object.fromEntries([
              [k1, root<Rec<K, Rec<K1, T>>>().of(f).of(k1)],
              [
                k2,
                $filter<U, Rec<K, Rec<K1, T>> & Rec<K2, Arr<BU>>, 'before'>({
                  as: 'before',
                  cond: eq<S | N, Rec<K, Rec<K1, T>> & Rec<K2, Arr<BU>>, { readonly before: U }>(
                    field2.get(ctx('before')),
                  )(root<Rec<K, Rec<K1, T>>>().of(f).of(k1).of(field1)),
                  expr: root<Rec<K2, Arr<BU>>>().of(k2).of('before'),
                }),
              ],
            ]),
          )
        },
      ),
    )
    .with<Delta<Rec<K1, T> & Rec<K2, U>>>($unwindDelta(k1, k2)).stages
}
