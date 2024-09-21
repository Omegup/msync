import type { Frame } from '../../types'
import { map } from '../map-object'
import type { KEYS, RaceWinner, RaceWinnerAndSources, SourceIteratorResults } from './types'

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

