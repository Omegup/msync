import type { Iterator, IteratorResult, NextData, Working } from '../types'
import { map } from './map-object'

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

type SourceIteratorResults<K extends string, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<readonly Result[], Dom[P]>
}

type SourceResults<K extends string, Dom extends Record<K, Working>> = {
  readonly [P in K]: { source: P; value: Dom[P]; work: Dom[P]['work'] }
}[K]
type SourceNextData<K extends string, Result, Dom extends Record<K, Working>> = {
  readonly [P in K]: { source: P; next: NextData<readonly Result[], Dom[P]> }
}[K]

type Iterators<K extends string, T, Dom extends Record<K, unknown>> = {
  readonly [P in K]: Iterator<T, Dom[P]>
}

export const mergeItResults = <K extends string, Result, Dom extends Record<K, Working>>(
  sources: SourceIteratorResults<K, Result, Dom>,
  working?: PromiseLike<
    readonly [NextData<readonly Result[], Dom[K]>, { readonly work: object }, K]
  >,
): IteratorResult<readonly Result[], SourceResults<K, Dom>> => {
  const withWork = <T>({ work, ...r }: Working, k: K, x: PromiseLike<T>) =>
    work && x.then(y => [y, { work, ...r }, k] as const)
  const stop = () =>
    mergeIterators(
      map<typeof sources, K, Iterators<K, readonly Result[], Dom>>(sources, x => () => x.stop()),
    )
  type Next = SourceNextData<K, Result, Dom>
  const nextData = ({ next, source }: Next): NextData<readonly Result[], SourceResults<K, Dom>> => {
    const result = next.cont()
    type It = IteratorResult<readonly Result[], Dom[K]>
    const patch: Record<K, It> = Object.fromEntries([[source, result]])
    return {
      cont: () =>
        mergeItResults({ ...sources, ...patch }, withWork(next.info, source, result.next)),
      data: next.data,
      info: { source, value: next.info, work: next.info.work },
    }
  }
  const run = async (): Promise<NextData<readonly Result[], SourceResults<K, Dom>>> => {
    const val = await working
    if (val) {
      const [next, work, source] = val
      if (work === next.info.work) {
        return nextData({ next, source })
      }
    }
    const promises: readonly PromiseLike<Next>[] = Object.values<PromiseLike<Next>>(
      map<typeof sources, K, Record<K, PromiseLike<Next>>>(sources, ({ next }, source) =>
        next.then((next): Next => ({ source, next })),
      ),
    )
    return Promise.race<readonly Next[], 0>(promises).then(nextData)
  }
  return {
    stop,
    next: run(),
  }
}

export const mergeIterators = <K extends string, Result, Dom extends Record<K, Working>>(
  iterators: Iterators<K, readonly Result[], Dom>,
) =>
  mergeItResults(
    map<typeof iterators, K, SourceIteratorResults<K, Result, Dom>>(iterators, v => v()),
  )
