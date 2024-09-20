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
  }
}[K]

type RaceWinnerAndSources<K extends KEYS, Result, Dom extends Record<K, unknown>, WinnerExtra> = {
  readonly winner: RaceWinner<K, Result, Dom> & WinnerExtra
  readonly sources: SourceIteratorResults<K, Result, Dom>
}
export type GRace<W, NextExtra> = <K extends KEYS, Result, Dom extends Record<K, W>>(
  arg: SourceIteratorResults<K, Result, Dom>,
) => PromiseLike<RaceWinnerAndSources<K, Result, Dom, NextExtra>>
type Race<W, K extends KEYS, Result, Dom extends Record<K, W>, NextExtra> = (
  arg: SourceIteratorResults<K, Result, Dom>,
) => PromiseLike<RaceWinnerAndSources<K, Result, Dom, NextExtra>>

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
    type Winner = RaceWinnerAndSources<K, Result, Dom, NextExtra>
    type Sources = SourceIteratorResults<K, Result, Dom>
    const promises: readonly PromiseLike<Winner>[] = Object.values<PromiseLike<Winner>>(
      map<Sources, K, Record<K, PromiseLike<Winner>>>(sources, ({ next }, key) =>
        next.then(frame => ({
          sources,
          winner: buildWinner<K, Result, Dom>({ key, sources, frame }),
        })),
      ),
    )
    return Promise.race<readonly Winner[], 0>(promises)
  }

export const makeMergeItResults = <W, F extends HKT<W>, WinnerExtra = unknown>(params: {
  intercept: <K extends KEYS, Result, Dom extends Record<K, W>>(
    winner: RaceWinner<K, Result, Dom> & WinnerExtra,
    nextFrame: NextFrame<Result, Dom[K]>,
    sources: SourceIteratorResults<K, Result, Dom>,
  ) => PromiseLike<RaceWinnerAndSources<K, Result, Dom, WinnerExtra>>
  info: <K extends KEYS, Dom extends Record<K, W>>(
    key: K,
    info: Dom[K],
  ) => FSourceResults<K, W, F, Dom>
  race: GRace<W, WinnerExtra>
}) => {
  const { info, intercept, race: defaultRace } = params
  const mergeItResults = <K extends KEYS, Result, Dom extends Record<K, W>>(
    sources: SourceIteratorResults<K, Result, Dom>,
    race: Race<W, K, Result, Dom, WinnerExtra> = defaultRace,
  ): IteratorResult<Result, FSourceResults<K, W, F, Dom>> => {
    type Sources = SourceIteratorResults<K, Result, Dom>
    type WinnerAndSources = RaceWinnerAndSources<K, Result, Dom, WinnerExtra>
    type CurFrame = Frame<Result, FSourceResults<K, W, F, Dom>>
    /**
     * Reiterates over the results, continuing the iteration process.
     * - `frame`: The resulting frame from the asynchronous source.
     * - `key`: The source key of the data.
     */
    const reiterate = ({ winner, sources }: WinnerAndSources): CurFrame => {
      const { frame, key } = winner,
        result = frame.cont()
      return {
        cont: () =>
          mergeItResults<K, Result, Dom>(patch<Sources, K>(sources, key, result), sources =>
            intercept(winner, result.next, sources),
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
