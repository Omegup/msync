// first emission means every descendent is done first aggregation
// type Iter = AsyncIterator<void, never, never>
export type Machine<T> = (
  restart: AsyncIterator<void, never, void>,
) => AsyncIterator<T, never, void>
export type RunnerSource<T, S extends Dom, Dom> = () => IteratorResult<T, S, Dom>

export type Runner<T, Dom> = Iterator<T, Dom>

export type IteratorResult<T, S extends Dom, Dom> = {
  data: T
  next: PromiseLike<S>
  cont: Continuation<T, S, Dom>
  stop: () => void
}

export type Continuation<T, S extends Dom, Dom> = (
  prev: S,
) => <E>(consume: <N extends Dom>(next: IteratorResult<T, N, Dom>) => E) => E

export type Iterator<T, Dom> = <E>(
  consume: <N extends Dom>(result: IteratorResult<T, N, Dom>) => E,
) => E

export type AsynIter<T> = readonly [T, () => PromiseLike<AsynIter<T>>]

const run = <T, Dom>(cont: Iterator<T, Dom>) => cont(next => runCont(next))
const runCont = async <T, S extends Dom, Dom>({
  next,
  cont,
}: IteratorResult<T, S, Dom>): Promise<never> => {
  const v: S = await next
  return cont(v)(next => runCont(next))
}
const link = <T, S extends Dom, Dom>({
  data,
  next,
  cont,
}: IteratorResult<T, S, Dom>): AsynIter<T> => {
  return [data, () => next.then(v => cont(v)(next => link(next)))]
}
const iterate = <T>([, next]: AsynIter<T>): PromiseLike<never> => next().then(iterate)
