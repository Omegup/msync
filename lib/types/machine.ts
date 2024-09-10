// first emission means every descendent is done first aggregation

import type { App, HKT } from '../../types'

export type Working = { work: object | undefined }
export type Runner<T, Dom extends Working> = Iterator<T, Dom>

export type Machine<T, Dom = unknown> = Iterator<T, Dom>

export type NextAsync<T, Dom> = PromiseLike<NextData<T, Dom>>

export type NextData<T, Dom> = {
  data: T
  info: Dom
  cont: Iterator<T, Dom>
}


export type IteratorResult<out T, out Dom> = {
  next: NextAsync<T, Dom>
  stop: Iterator<T, Dom>
}

export type Exists<in out F extends HKT<Dom>, out Dom = unknown> = <E>(
  consume: <T extends Dom>(data: App<F, T>) => E,
) => E

export type Iterator<out T, out Dom> = () => IteratorResult<T, Dom>

export type AsynIter<T> = readonly [T, () => PromiseLike<AsynIter<T>>]
