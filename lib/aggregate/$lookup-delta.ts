import type { Arr, ID, JsonObj, N, RORec, Rec, doc } from '../../types'
import { $filter } from '../expression/array'
import { field } from '../expression/concat'
import { eq } from '../expression/logic'
import { ctx, root, type Path } from '../field'
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
  { field1, field2 }: { field1: Path<T, S>; field2: Path<U, S> },
  { stages, coll }: TStages<R, Before<U>>,
  k1: K1,
  k2: K2,
): RawStages<Delta<T>, Delta<Rec<K1, T> & Rec<K2, U> & ID>> => {
  type BU = Before<U>
  type DeltaS = RORec<BA, S | N>
  const f2: Expr<S, BU> = root<BU>().of('before').with(field2).expr()
  return link<Delta<T>>()
    .with<Delta<Rec<K1, T>>>($replaceWithDelta<T, Rec<K1, T>>(field(map1(k1, root<T>().expr()))))
    .with<Delta<Rec<K1, T>> & Rec<K2, Arr<BU>>>(
      $simpleLookup_({
        coll,
        k: k2,
        vars: {
          after: root<Delta<Rec<K1, T>>>().of('after').of(k1).with(field1).expr(),
          before: root<Delta<Rec<K1, T>>>().of('before').of(k1).with(field1).expr(),
        },
        pipeline: concatStages(
          stages,
          $match_(
            $or(
              $expr(eq<S | N, BU, DeltaS>(ctx<S | N>()('before').expr())(f2)),
              $expr(eq<S | N, BU, DeltaS>(ctx<S | N>()('after').expr())(f2)),
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
                    ctx<U>()('before').with(field2).expr(),
                  )(root<Rec<K, Rec<K1, T>>>().of(f).of(k1).with(field1).expr()),
                  expr: root<Rec<K2, Arr<BU>>>().of(k2).of('before').expr(),
                }),
              ],
            ]),
          )
        },
      ),
    )
    .with<Delta<Rec<K1, T> & Rec<K2, U> & ID>>($unwindDelta(k1, k2)).stages
}
