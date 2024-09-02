import type { Arr, Rec } from '../../types'
import type { Delta, RawStages } from '../types'
import { asStages } from './prefix'


type s = string

export const $unwindDelta = <T, K extends s, U>(
  k: K,
): RawStages<Delta<T & Rec<K, Arr<U>>>, Delta<T & Rec<K, U>>> =>
  asStages<T & Rec<K, Arr<U>>, T & Rec<K, U>>([{ $unwind: `$${k}` }])


