import type { Arr, N, RORec, Rec } from '../../types'
import { $filter } from '../expression/array'
import { field } from '../expression/concat'
import { eq } from '../expression/logic'
import { $getField, ctx } from '../expression/val'
import { root } from '../field'
import { $expr } from '../predicate/$expr'
import { $or } from '../query/logic'
import type { BA, Before, Delta, Expr, RawStages, TStages } from '../types'
import { $match_, $simpleLookup_ } from './$match-raw'
import { $replaceWithDelta, $replaceWithEach } from './$replace-with-each'
import { $unwindDelta } from './$unwind-delta'
import { concatStages, link } from './prefix'

type s = string
export const $lookupDelta = <Tx extends s, Ux extends s, R, S, K1 extends s, K2 extends s>(
  { field1: localField, field2: foreignField }: { field2: Ux; field1: Tx },
  { stages, coll }: TStages<R, Before<Rec<Ux, S>>>,
  left: K1,
  right: K2,
): RawStages<Delta<Rec<Tx, S>>, Delta<Rec<K1, Rec<Tx, S>> & Rec<K2, Rec<Ux, S>>>> => {
  type U = Rec<Ux, S>
  type T = Rec<Tx, S>
  type BU = Before<U>
  type DeltaS = RORec<BA, S | N>
  const f2: Expr<S, BU> = root<BU>().of('before').of(foreignField)
  return link<Delta<T>>()
    .with<Delta<Rec<K1, T>>>(
      $replaceWithDelta<T, Rec<K1, T>>(
        field(Object.fromEntries<Record<K1, Expr<T, T>>>([[left, root()]])),
      ),
    )
    .with<Delta<Rec<K1, T>> & Rec<K2, Arr<BU>>>(
      $simpleLookup_({
        coll,
        k: right,
        vars: {
          after: root<Delta<Rec<K1, T>>>().of('after').of(left).of(localField),
          before: root<Delta<Rec<K1, T>>>().of('before').of(left).of(localField),
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
    ) // {before: {left: T}, after: {left: T}, right: {before: [U, U, U]}}}
    .with<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>>(
      $replaceWithEach<Rec<K1, T>, Rec<K1, T> & Rec<K2, Arr<U>>, Rec<K2, Arr<BU>>>(
        <K extends BA>(
          f: K,
        ): Expr<
          Rec<K1, T> & Rec<K2, Arr<U>>,
          Rec<K, Rec<K1, T>> & Delta<Rec<K1, T>> & Rec<K2, Arr<BU>>
        > => {
          return field<RORec<K1, T> & RORec<K2, Arr<U>>, Rec<K, Rec<K1, T>> & Rec<K2, Arr<BU>>>(
            Object.fromEntries([
              [left, root<Rec<K, Rec<K1, T>>>().of(f).of(left)],
              [
                right,
                $filter<U, Rec<K, Rec<K1, T>> & Delta<Rec<K1, T>> & Rec<K2, Arr<BU>>, 'before'>({
                  as: 'before',
                  cond: eq<
                    S | N,
                    Rec<K, Rec<K1, T>> & Delta<Rec<K1, T>> & Rec<K2, Arr<BU>>,
                    { readonly before: U }
                  >($getField(ctx('before'), foreignField))(
                    root<Rec<K, Rec<K1, T>>>().of(f).of(left).of(localField),
                  ),
                  expr: root<Rec<K2, Arr<BU>>>().of(right).of('before'),
                }),
              ],
            ]),
          )
        },
      ),
    ) // {before: {left: T, right: [U, U]}, after: {left: T, right: [U, U]}}
    .with<Delta<Rec<K1, T> & Rec<K2, U>>>($unwindDelta<Rec<K1, T>, K2, U>(right)).stages
}
