import type { App, Arr, HKT, J, RORec, Rec, doc } from '../../types'
import { concat, field, fieldM } from '../expression/concat'
import { eq } from '../expression/logic'
import { val } from '../expression/val'
import { Field, ctx, root } from '../field'
import { $expr } from '../predicate/$expr'
import type { Before, Expr, RawStages, TStages } from '../types'
import { map1 } from '../utils/json'
import { $match_, $replaceWith1, $replaceWith_, $simpleLookup1, $unwind1 } from './mongo-stages'
import { link } from './prefix'

type s = string

export const $lookupRaw =
  <T extends doc, U extends doc, R, S, K1 extends s, K2 extends s>(
    { field1, field2 }: { field1: Field<T, S>; field2: Field<U, S> },
    { stages, coll }: TStages<R, Before<U>>,
    k1: K1,
    k2: K2,
    dict: RORec<K1, 'a'> & RORec<K2, 'b'>,
  ) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<App<F, T>, App<F, Rec<K1, T> & Rec<K2, U> & { readonly _id: string }>> => {
    type D = Rec<K1, T> & Rec<K2, U>
    return link<App<F, T>>()
      .with<App<F, Rec<K1, T>>>(
        $replaceWith1<T, Rec<K1, T>>(field(map1<K1, Expr<T, T>>(k1, root<T>().expr())))(f),
      )
      .with<App<F, Rec<K1, T> & Rec<K2, Arr<U>>>>(
        $simpleLookup1<Rec<K1, T>, U, R, K2, { readonly local: S }, unknown>({
          coll,
          k: k2,
          vars: { local: root<Rec<K1, T>>().of(k1).with(field1).expr() },
          pipeline: link<R, { readonly local: S }>()
            .with(stages)
            .with<U>($replaceWith_(root<Before<U>>().of('before').expr()))
            .with<U>(
              $match_(
                $expr(eq<S, U, { readonly local: S }>(ctx<S>()('local').expr())(field2.expr())),
              ),
            ).stages,
        })(f),
      )
      .with<App<F, D>>($unwind1<Rec<K1, T>, K2, U>(k2)(f))
      .with<App<F, Rec<K1, T> & Rec<K2, U> & { readonly _id: string }>>(
        $replaceWith1(
          fieldM<
            RORec<K1, 'a'> & RORec<K2, 'b'> & { readonly _id: string },
            { a: T; b: U; _id: string },
            D
          >(
            {
              a: root<Rec<K1, T>>().of(k1).expr(),
              b: root<D>().of(k2).expr(),
              _id: concat(
                root<Rec<K1, T>>().of(k1).of('_id').expr(),
                val('.'),
                root<D>().of(k2).of('_id').expr(),
              ),
            },
            { ...dict, _id: '_id' },
          ),
        )(f),
      ).stages
  }
