// first emission means every descendent is done first aggregation

import type { App, HKT, I } from '../../types'

// type Iter = AsyncIterator<void, never, never>
export type RunnerSource<T, S extends Dom, Dom> = () => IteratorResult<T, S, Dom>

export type Working = { work: true | undefined }
export type Runner<T, Dom extends Working> = Iterator<T, Dom>

export type Machine<T, Dom = unknown> = Iterator<T, Dom>

export type IteratorResult<out T, in out S extends Dom, out Dom> = {
  data: T
  next: PromiseLike<S>
  cont: Continuation<T, S, Dom>
  stop: () => Iterator<T, Dom>
}
export type Exists<in out F extends HKT<Dom>, out Dom = unknown> = <E>(
  consume: <T extends Dom>(data: App<F, T>) => E,
) => E

export type Continuation<out T, in S extends Dom, out Dom> = (prev: S) => Iterator<T, Dom>

export interface IteratorResultHKT<Dom, T> extends HKT<Dom> {
  readonly out: IteratorResult<T, I<Dom, this>, Dom>
}

export type Iterator<out T, out Dom> = Exists<IteratorResultHKT<Dom, T>, Dom>

export type AsynIter<T> = readonly [T, () => PromiseLike<AsynIter<T>>]

const run = <T, Dom>(cont: Iterator<T, Dom>) => cont(next => runCont(next))
const runCont = async <T, S extends Dom, Dom>({
  next,
  cont,
}: IteratorResult<T, S, Dom>): Promise<never> => {
  const v: S = await next
  return cont(v)(runCont)
}
const link = <T, S extends Dom, Dom>({
  data,
  next,
  cont,
}: IteratorResult<T, S, Dom>): AsynIter<T> => {
  return [data, () => next.then(v => cont(v)(next => link(next)))]
}
const iterate = <T>([, next]: AsynIter<T>): PromiseLike<never> => next().then(iterate)
