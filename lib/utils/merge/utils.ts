import { map } from '../map-object'
import type { KEYS, RaceWinner, SourceIteratorResults } from './types'

export const patch = <T, K extends keyof T>(x: T, k: K, v: T[K]): T => ({ ...x, [k]: v })
export const restart = <K extends KEYS, Result, Info extends Record<K, unknown>>(
  sources: SourceIteratorResults<K, Result, Info>,
) => {
  type Sources = SourceIteratorResults<K, Result, Info>
  return map<Sources, K, Sources>(sources, x => x.stop())
}

export const race = async <W, K extends KEYS, Result, Info extends Record<K, W>>(
  sources: SourceIteratorResults<K, Result, Info>,
) => {
  type Winner = RaceWinner<K, Result, Info>
  type Sources = SourceIteratorResults<K, Result, Info>
  const promises: readonly PromiseLike<Winner>[] = Object.values<PromiseLike<Winner>>(
    map<Sources, K, Record<K, PromiseLike<Winner>>>(sources, ({ next }, key) =>
      next.then(frame => ({ key, sources, frame })),
    ),
  )
  return Promise.race<readonly Winner[], 0>(promises)
}
