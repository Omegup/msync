import type { App, HKT } from '../../types'
import type { Frame, IteratorResult, NextFrame } from '../types'
import { map } from './map-object'

type KEYS = string
type SourceIteratorResults<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<Result, Dom[P]>
}

type FSourceResults<K extends KEYS, W, F extends HKT<W>, Dom extends Record<K, W>> = {
  readonly [P in K]: { source: P; value: Dom[P] } & App<F, Dom[P]>
}[K]
type SourceNextData<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: { source: P; frame: Frame<Result, Dom[P]> }
}[K]

type Chain<T, V> = (x: (x: V) => PromiseLike<T>) => (x: V) => PromiseLike<T>
type Interceptor<K extends KEYS, Result, Dom extends Record<K, unknown>, NextExtra> = Chain<
  SourceNextData<K, Result, Dom> & NextExtra,
  SourceIteratorResults<K, Result, Dom>
>

type MakeNext<in W, NextExtra> = <K extends KEYS, Result, Dom extends Record<K, W>>(
  source: K,
) => (frame: Frame<Result, Dom[K]>) => SourceNextData<K, Result, Dom> & NextExtra

const patch = <T, K extends keyof T>(x: T, k: K, v: T[K]): T => ({ ...x, [k]: v })
export const makeMergeItResults = <
  W,
  F extends HKT<W>,
  NextExtra = unknown,
>(params: {
  interceptor: <K extends KEYS, Result, Dom extends Record<K, W>>(
    info: Dom[K],
    source: K,
    next: NextFrame<Result, Dom[K]>,
  ) => Interceptor<K, Result, Dom, NextExtra>
  info: <K extends KEYS, Dom extends Record<K, W>>(
    source: K,
    info: Dom[K],
  ) => FSourceResults<K, W, F, Dom>
  makeNext: MakeNext<W, NextExtra>
}) => {
  const { info, interceptor, makeNext } = params
  const mergeItResults = <K extends KEYS, Result, Dom extends Record<K, W>>(
    sources: SourceIteratorResults<K, Result, Dom>,
    intercept: Interceptor<K, Result, Dom, NextExtra> = x => x,
  ): IteratorResult<Result, FSourceResults<K, W, F, Dom>> => {
    type Sources = SourceIteratorResults<K, Result, Dom>
    const stop = () => mergeItResults(map<Sources, K, Sources>(sources, x => x.stop()))
    type Next = SourceNextData<K, Result, Dom> & NextExtra
    /**
     * Reiterates over the results, continuing the iteration process.
     * - `frame`: The resulting frame from the asynchronous source.
     * - `source`: The source key of the data.
     */
    const reiterate = ({ frame, source }: Next): Frame<Result, FSourceResults<K, W, F, Dom>> => {
      const result = frame.cont()
      return {
        cont: () =>
          mergeItResults<K, Result, Dom>(
            patch<Sources, K>(sources, source, result),
            interceptor(frame.info, source, result.next),
          ),
        data: frame.data,
        info: info(source, frame.info),
      }
    }
    /**
     * Races the asynchronous iterators from all sources and returns the result of the fastest one.
     */
    const raceSources = async (sources: Sources): Promise<Next> => {
      const promises: readonly PromiseLike<Next>[] = Object.values<PromiseLike<Next>>(
        map<Sources, K, Record<K, PromiseLike<Next>>>(sources, ({ next }, source) =>
          next.then(x => makeNext<K, Result, Dom>(source)(x)),
        ),
      )
      return Promise.race<readonly Next[], 0>(promises)
    }
    // The main `IteratorResult` returned by `mergeItResults`.
    return {
      stop,
      next: intercept(raceSources)(sources).then(reiterate),
    }
  }
  return mergeItResults
}
