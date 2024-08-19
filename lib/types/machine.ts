// first emission means every descendent is done first aggregation
// type Iter = AsyncIterator<void, never, never>
export type Machine<T> = (
  restart: AsyncIterator<void, never, void>,
) => AsyncIterator<T, never, void>
export type RunnerSource<T, S> = () => IteratorResult<T, S>

export type Runner<T> = Iterator<T>

export type IteratorResult<T, S> = readonly [T, PromiseLike<S>, Continuation<T, S>, stop: ()=>void]

export type Continuation<T, S> = (prev: S) => <E>(
  consume: <N>(next: IteratorResult<T, N>) => E,
) => E
export type Iterator<T> = Continuation<T, void>

export type AsynIter<T> = readonly [T, () => PromiseLike<AsynIter<T>>]

const run = <T>(cont: Iterator<T>) => cont()(next => runCont(next))
const runCont = async <T, S>([, next, cont]: IteratorResult<T, S>): Promise<never> => {
  const v: S = await next
  return cont(v)(next => runCont(next))
}
const link = <T, S>([data, next, cont]: IteratorResult<T, S>): AsynIter<T> => {
  return [data, () => next.then(v => cont(v)(next => link(next)))]
}
const iterate = <T>([, next]: AsynIter<T>): PromiseLike<never> => next().then(iterate)
