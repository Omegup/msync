// first emission means every descendent is done first aggregation
// type Iter = AsyncIterator<void, never, never>
export type Machine<T> = (
  restart: AsyncIterator<void, never, void>,
) => AsyncIterator<T, never, void>
export type RunnerSource<T, S> = AsyncIterator<
  [data: T, nextReady: PromiseLike<S>],
  never,
  S | void
>
export type Runner<T> = <E>(c: <S>(x: RunnerSource<T, S>) => E) => E
