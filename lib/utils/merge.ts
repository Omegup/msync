import type { Continuation, IteratorResult } from '../types'

export async function* merge<T>(
  asyncIterators: readonly AsyncIterator<T, unknown, never>[],
): AsyncIterator<T, void, never> {
  const promises = asyncIterators.map(iterator => iterator.next())

  while (promises.length > 0) {
    const { value, index, done } = await Promise.race(
      promises.map((p, index) => p.then(res => ({ ...res, index }))),
    )
    if (done) {
      promises.splice(index, 1)
    } else {
      yield value
      promises[index] = asyncIterators[index].next()
    }
  }
}

type Sources<K extends string, S extends Dom, Result, Dom extends Record<K, unknown>> = {
  [P in K]: IteratorResult<readonly Result[], S[P], Dom[P]>
}

export const mergeIt = <K extends string, S extends Dom, Result, Dom extends Record<K, unknown>>(
  sources: Sources<K, S, Result, Dom>,
): IteratorResult<
  readonly Result[],
  { [P in K]: { source: P; value: S[P] } }[K],
  { [P in K]: { source: P; value: Dom[P] } }[K]
> => {
  type Next<S2 extends Dom = S> = { [P in K]: { source: P; value: S2[P] } }[K]
  type NDom = Next<Dom>
  const run = (): IteratorResult<readonly Result[], Next, NDom> => {
    const cont: Continuation<readonly Result[], Next, NDom> =
      (prev: Next) =>
      <E>(consume: <N extends NDom>(next: IteratorResult<readonly Result[], N, NDom>) => E): E => {
        const f = <P extends K>({ source, value }: { source: P; value: S[P] }) =>
          sources[source].cont(value)(
            <N extends Dom[P]>(next: IteratorResult<readonly Result[], N, Dom[P]>) => {
              const patched = {
                ...sources,
                ...Object.fromEntries([[source, next]]),
              } as Sources<K, S & Record<P, N>, Result, Dom>
              return consume(mergeIt(patched))
            },
          )
        return f(prev)
      }

    const promises: readonly PromiseLike<Next<S>>[] = Object.entries(sources).map(([k, v]) =>
      v.next.then((x): Next<S> => ({ source: k, value: x })),
    )
    return {
      data: Object.entries(sources).flatMap(([, v]) => v.data),
      next: Promise.race<readonly Next[], 0>(promises),
      cont,
      stop: () => {
        Object.entries(sources).forEach(([, v]) => v.stop())
      },
    }
  }
  return run()
}
