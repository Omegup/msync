import type { Arr, AsLiteral, doc, O, Rec, RORec } from '../../../types'
import { mergeObjects } from '../../expression/array'
import { field, fieldM } from '../../expression/concat'
import { root } from '../../field'
import type { Delta, DeltaStages } from '../../types'
import { $unwind1 } from '../mongo-stages'
import { link } from '../prefix'
import { $replaceWithDelta } from '../set/$set-delta'
import { $unwindDelta } from './$unwind-delta'

export { $unwindDelta } from './$unwind-delta'
type s = string

type LR<T, U> = O<{ readonly left: T; readonly right: U }>

export const $unwind = <T extends doc, K extends s, U extends doc>(
  k: AsLiteral<K>,
  dict: RORec<K, 'key'>,
): DeltaStages<O, T & Rec<K, Arr<U>>, T & Rec<K, U>> => ({
  delta: link<Delta<T & Rec<K, Arr<U>>>>()
    .with<unknown, Delta<LR<T & Rec<K, Arr<U>>, Arr<U>>>>(
      $replaceWithDelta(
        field({
          left: ['left', root<T & Rec<K, Arr<U>>>().expr()],
          right: ['right', root<Rec<K, Arr<U>>>().of(k).expr()],
        }),
      ),
    )
    .with<unknown, Delta<LR<T & Rec<K, Arr<U>>, U>>>(
      $unwindDelta<'left', T & Rec<K, Arr<U>>, 'right', U>('left', 'right', false),
    )
    .with<unknown, Delta<T & Rec<K, U>>>(
      $replaceWithDelta<LR<T & Rec<K, Arr<U>>, U>, T & Rec<K, U>>(
        mergeObjects<T, Rec<K, U>, LR<T & Rec<K, Arr<U>>, U>>(
          root<LR<T & Rec<K, Arr<U>>, U>>().of('left').expr(),
          fieldM<RORec<K, 'key'>, RORec<'key', U>, LR<T & Rec<K, Arr<U>>, U>>(
            {
              key: root<LR<T & Rec<K, Arr<U>>, U>>().of('right').expr(),
            },
            dict,
          ),
        ),
      ),
    ).stages,
  raw: $unwind1<T, K, U>(k),
})
