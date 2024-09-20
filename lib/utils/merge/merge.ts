import type { App, HKT } from '../../../types'
import type { Frame, IteratorResult, NextFrame } from '../../types'
import { map } from '../map-object'

type KEYS = string
type SourceIteratorResults<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<Result, Dom[P]>
}

type FSourceResults<K extends KEYS, W, F extends HKT<W>, Dom extends Record<K, W>> = {
  readonly [P in K]: { readonly key: P; readonly value: Dom[P] } & App<F, Dom[P]>
}[K]
type RaceWinner<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: {
    readonly key: P
    readonly frame: Frame<Result, Dom[P]>
    readonly sources: SourceIteratorResults<K, Result, Dom>
  }
}[K]

type Race<K extends KEYS, Result, Dom extends Record<K, unknown>, NextExtra> = (
  arg: SourceIteratorResults<K, Result, Dom>,
) => PromiseLike<RaceWinner<K, Result, Dom> & NextExtra>

type BuildWinner<in W, NextExtra> = <K extends KEYS, Result, Dom extends Record<K, W>>(p: {
  key: K
  sources: SourceIteratorResults<K, Result, Dom>
  frame: Frame<Result, Dom[K]>
}) => RaceWinner<K, Result, Dom> & NextExtra

export const patch = <T, K extends keyof T>(x: T, k: K, v: T[K]): T => ({ ...x, [k]: v })
export const restart = <K extends KEYS, Result, Dom extends Record<K, unknown>>(
  sources: SourceIteratorResults<K, Result, Dom>,
) => {
  type Sources = SourceIteratorResults<K, Result, Dom>
  return map<Sources, K, Sources>(sources, x => x.stop())
}

export const racer =
  <W, NextExtra>(buildWinner: BuildWinner<W, NextExtra>) =>
  async <K extends KEYS, Result, Dom extends Record<K, W>>(
    sources: SourceIteratorResults<K, Result, Dom>,
  ) => {
    type Winner = RaceWinner<K, Result, Dom> & NextExtra
    type Sources = SourceIteratorResults<K, Result, Dom>
    const promises: readonly PromiseLike<Winner>[] = Object.values<PromiseLike<Winner>>(
      map<Sources, K, Record<K, PromiseLike<Winner>>>(sources, ({ next }, key) =>
        next.then(frame => buildWinner<K, Result, Dom>({ key, sources, frame })),
      ),
    )
    return Promise.race<readonly Winner[], 0>(promises)
  }

export const makeMergeItResults = <W, F extends HKT<W>, NextExtra = unknown>(params: {
  nextWinner: <K extends KEYS, Result, Dom extends Record<K, W>>(
    winner: RaceWinner<K, Result, Dom> & NextExtra,
    nextFrame: NextFrame<Result, Dom[K]>,
  ) => PromiseLike<RaceWinner<K, Result, Dom> & NextExtra>
  info: <K extends KEYS, Dom extends Record<K, W>>(
    key: K,
    info: Dom[K],
  ) => FSourceResults<K, W, F, Dom>
  buildWinner: BuildWinner<W, NextExtra>
}) => {
  const { info, nextWinner, buildWinner } = params
  const mergeItResults = <K extends KEYS, Result, Dom extends Record<K, W>>(
    sources: SourceIteratorResults<K, Result, Dom>,
    race: Race<K, Result, Dom, NextExtra> = racer(buildWinner),
  ): IteratorResult<Result, FSourceResults<K, W, F, Dom>> => {
    type Sources = SourceIteratorResults<K, Result, Dom>
    type Winner = RaceWinner<K, Result, Dom> & NextExtra
    /**
     * Reiterates over the results, continuing the iteration process.
     * - `frame`: The resulting frame from the asynchronous source.
     * - `key`: The source key of the data.
     */
    const reiterate = (winner: Winner): Frame<Result, FSourceResults<K, W, F, Dom>> => {
      const { frame, key, sources } = winner,
        result = frame.cont()
      return {
        cont: () =>
          mergeItResults<K, Result, Dom>(patch<Sources, K>(sources, key, result), sources =>
            nextWinner({ ...winner, sources }, result.next),
          ),
        data: frame.data,
        info: info(key, frame.info),
      }
    }
    // The main `IteratorResult` returned by `mergeItResults`.
    return {
      stop: () => mergeItResults(restart(sources)),
      next: race(sources).then(reiterate),
    }
  }
  return mergeItResults
}
