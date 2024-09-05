import type { Arr, RORec, Rec, doc } from '../../types'
import { concat, field, fieldM } from '../expression/concat'
import { eq } from '../expression/logic'
import { val } from '../expression/val'
import { Field, ctx, root } from '../field'
import { $expr } from '../predicate/$expr'
import type { Before, Expr, RawStages, TStages } from '../types'
import { map1 } from '../utils/json'
import { $match_, $replaceWith_, $simpleLookup_, $unwind_ } from './mongo-stages'
import { link } from './prefix'

type s = string
export const $lookupRaw = <T extends doc, U extends doc, R, S, K1 extends s, K2 extends s>(
  { field1, field2 }: { field1: Field<T, S>; field2: Field<U, S> },
  { stages, coll }: TStages<R, Before<U>>,
  k1: K1,
  k2: K2,
  dict: RORec<K1, 'a'> & RORec<K2, 'b'>,
): RawStages<Before<T>, Before<Rec<K1, T> & Rec<K2, U> & { readonly _id: string }>> => {
  type D = Before<Rec<K1, T>> & Rec<K2, U>
  return link<Before<T>>()
    .with<Before<Rec<K1, T>>>(
      $replaceWith_<Before<T>, Before<Rec<K1, T>>>(
        field({
          before: field(map1<K1, Expr<T, Before<T>>>(k1, root<Before<T>>().of('before').expr())),
        }),
      ),
    )
    .with<Before<Rec<K1, T>> & Rec<K2, Arr<U>>>(
      $simpleLookup_<Before<Rec<K1, T>>, U, R, K2, { readonly local: S }, unknown>({
        coll,
        k: k2,
        vars: { local: root<Before<Rec<K1, T>>>().of('before').of(k1).with(field1).expr() },
        pipeline: link<R, { readonly local: S }>()
          .with(stages)
          .with<U>($replaceWith_(root<Before<U>>().of('before').expr()))
          .with<U>(
            $match_(
              $expr(eq<S, U, { readonly local: S }>(ctx<S>()('local').expr())(field2.expr())),
            ),
          ).stages,
      }),
    )
    .with<D>($unwind_<Before<Rec<K1, T>>, K2, U>(k2))
    .with<Before<Rec<K1, T> & Rec<K2, U> & { readonly _id: string }>>(
      $replaceWith_(
        field({
          before: fieldM<
            RORec<K1, 'a'> & RORec<K2, 'b'> & { readonly _id: string },
            { a: T; b: U; _id: string },
            D
          >(
            {
              a: root<Before<Rec<K1, T>>>().of('before').of(k1).expr(),
              b: root<D>().of(k2).expr(),
              _id: concat(
                root<Before<Rec<K1, T>>>().of('before').of(k1).of('_id').expr(),
                val('.'),
                root<D>().of(k2).of('_id').expr(),
              ),
            },
            { ...dict, _id: '_id' },
          ),
        }),
      ),
    ).stages
}
