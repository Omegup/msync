import type { App, HKT, I, RORec } from '../../types'
import type { Iterator, IteratorResult, NextAsync, NextData, Working } from '../types'
import { map } from './map-object'

type SourceIteratorResults<K extends string, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<Result, Dom[P]>
}

type FSourceResults<K extends string, W, F extends HKT<W>, Dom extends Record<K, W>> = {
  readonly [P in K]: { source: P; value: Dom[P] } & App<F, Dom[P]>
}[K]
interface WorkHKT extends HKT<Working> {
  readonly out: RORec<'work', I<Working, this>['work']>
}
type SourceNextData<K extends string, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: { source: P; next: NextData<Result, Dom[P]> }
}[K]

type Iterators<K extends string, T, Dom extends Record<K, unknown>> = {
  readonly [P in K]: Iterator<T, Dom[P]>
}

type Chain<T> = (x: () => PromiseLike<T>) => PromiseLike<T>
const makeMergeItResults = <W, F extends HKT<W>>({
  info,
  intercept,
}: {
  intercept: <K extends string, Result, Dom extends Record<K, W>>(
    info: Dom[K],
    source: K,
    nextPromise: NextAsync<Result, Dom[K]>,
  ) => Chain<SourceNextData<K, Result, Dom>>
  info: <K extends string, Dom extends Record<K, W>>(
    source: K,
    info: Dom[K],
  ) => FSourceResults<K, W, F, Dom>
}) => {
  const mergeItResults = <K extends string, Result, Dom extends Record<K, W>>(
    sources: SourceIteratorResults<K, Result, Dom>,
    inspect?: Chain<SourceNextData<K, Result, Dom>>,
  ): IteratorResult<Result, FSourceResults<K, W, F, Dom>> => {
    const stop = () =>
      mergeIterators(
        map<typeof sources, K, Iterators<K, Result, Dom>>(sources, x => () => x.stop()),
      )
    type Next = SourceNextData<K, Result, Dom>
    const reiterate = ({ next, source }: Next): NextData<Result, FSourceResults<K, W, F, Dom>> => {
      const result = next.cont()
      type It = IteratorResult<Result, Dom[K]>
      const patch: Record<K, It> = Object.fromEntries([[source, result]])
      return {
        cont: () =>
          mergeItResults<K, Result, Dom>(
            { ...sources, ...patch },
            intercept(next.info, source, result.next),
          ),
        data: next.data,
        info: info(source, next.info),
      }
    }
    const raceSources = async (): Promise<SourceNextData<K, Result, Dom>> => {
      const promises: readonly PromiseLike<Next>[] = Object.values<PromiseLike<Next>>(
        map<typeof sources, K, Record<K, PromiseLike<Next>>>(sources, ({ next }, source) =>
          next.then((next): Next => ({ source, next })),
        ),
      )
      return Promise.race<readonly Next[], 0>(promises)
    }
    return {
      stop,
      next: (inspect ?? (x => x()))(raceSources).then(reiterate),
    }
  }
  const mergeIterators = <K extends string, Result, Dom extends Record<K, W>>(
    iterators: Iterators<K, Result, Dom>,
  ) =>
    mergeItResults(
      map<typeof iterators, K, SourceIteratorResults<K, Result, Dom>>(iterators, v => v()),
    )
  return mergeItResults
}

export const mergeItResults = makeMergeItResults<Working, WorkHKT>({
  info: (source, info) => ({ source, value: info, work: info.work }),
  intercept:
    ({ work }, source, nextPromise) =>
    async raceSources => {
      if (work) {
        const next = await nextPromise
        if (work === next.info.work) {
          return { next, source }
        }
      }
      return raceSources()
    },
})
