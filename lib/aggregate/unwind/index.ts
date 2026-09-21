import type { App, Arr, AsLiteral, doc, HKT, O, Rec, RORec } from '../../../types'
import { mergeObjects } from '../../expression/array'
import { field, fieldM } from '../../expression/concat'
import { root, type Field } from '../../field'
import type { Delta, DeltaStages } from '../../types'
import { set, to } from '../../update'
import { $set1, $unwind1 } from '../mongo-stages'
import { link } from '../prefix'
import { $replaceWithDelta } from '../set/$set-delta'
import { $unwindDelta, joinIdOf } from './$unwind-delta'

export { $unwindDelta, joinIdOf, type JoinId } from './$unwind-delta'
type s = string

type LR<T, U> = doc & { readonly left: T; readonly right: U }
type TOf<TT, K extends string> = doc & Omit<TT, K>

export const $unwind = <TT extends O, K extends s, U extends doc>(
  k: AsLiteral<K>,
  dict: RORec<K, 'key'> & RORec<'_id', 'id'>,
  middle = '.',
): DeltaStages<O, TOf<TT, K> & Rec<K, Arr<U>>, TOf<TT, K> & Rec<K, U>> => {
  type T = TOf<TT, K>
  type D = T & Rec<K, U>
  const joinK = ['left', middle, 'right'] as const
  return {
    delta: link<Delta<T & Rec<K, Arr<U>>>>()
      .with<unknown, Delta<LR<T & Rec<K, Arr<U>>, Arr<U>>>>(
        $replaceWithDelta(
          field({
            _id: ['_id', root<T & Rec<K, Arr<U>>>().of('_id').expr()],
            left: ['left', root<T & Rec<K, Arr<U>>>().expr()],
            right: ['right', root<Rec<K, Arr<U>>>().of(k).expr()],
          }),
        ),
      )
      .with<unknown, Delta<LR<T & Rec<K, Arr<U>>, U>>>(
        $unwindDelta<'left', T & Rec<K, Arr<U>>, 'right', U>(
          'left',
          'right',
          joinK,
        ),
      )
      .with<unknown, Delta<T & Rec<K, U>>>(
        $replaceWithDelta<LR<T & Rec<K, Arr<U>>, U>, T & Rec<K, U>>(
          mergeObjects<T, Rec<K, U>, LR<T & Rec<K, Arr<U>>, U>>(
            root<LR<T & Rec<K, Arr<U>>, U>>().of('left').expr(),
            fieldM<RORec<K, 'key'> & RORec<'_id', 'id'>, RORec<'key', U> & RORec<'id', string>, LR<T & Rec<K, Arr<U>>, U>>(
              {
                key: root<LR<T & Rec<K, Arr<U>>, U>>().of('right').expr(),
                id: root<LR<T & Rec<K, Arr<U>>, U>>().of('_id').expr(),
              },
              dict,
            ),
          ),
        ),
      ).stages,
    raw: <F extends HKT<O, O>>(f: <X extends O>() => Field<App<F, X>, X>) =>
      link<App<F, T & Rec<K, Arr<U>>>>()
        .with<App<F, T>, App<F, D>>($unwind1<T, K, U>(k)(f))
        .with<App<F, T>, App<F, D>>(
          $set1(
            set<RORec<'_id', string>>()<D, D>({
              _id: [
                '_id',
                to(
                  joinIdOf(
                    joinK,
                    'left',
                    root<D>().of('_id').expr(),
                    root<D>().of<D, K>(k).of<U, '_id'>('_id').expr(),
                  ),
                ),
              ],
            }),
          )(f),
        ).stages,
  }
}
