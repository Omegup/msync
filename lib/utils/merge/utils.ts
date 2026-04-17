import { map } from '../map-object'
import type { KEYS, RaceWinner, SourceIteratorResults } from './types'

export const patch = <T, K extends keyof T>({ ...x }: T, k: K, v: T[K]): T => {
  delete x[k]
  return { ...x, [k]: v }
}
export const restart = <K extends KEYS, Result, Info extends Record<K, unknown>>(
  sources: SourceIteratorResults<K, Result, Info>,
) => {
  type Sources = SourceIteratorResults<K, Result, Info>
  return map<Sources, K, Sources>(sources, x => x.stop())
}

/**
 * Races multiple source iterators against each other, returning the first one to complete.
 *
 * This function takes an object of source iterators and creates a race condition between
 * them using Promise mechanics. It returns the result of the first iterator to complete,
 * along with its corresponding key from the original object.
 *
 * @param sources - An object containing source iterators, each with a next() method that returns a Promise
 * @returns A promise that resolves to the first completed iterator result along with its key and all sources
 */
export const race = <W, K extends KEYS, Result, Info extends Record<K, W>>(
  sources: SourceIteratorResults<K, Result, Info>,
) => {
  type Winner = RaceWinner<K, Result, Info>
  type Sources = SourceIteratorResults<K, Result, Info>
  const promises: readonly PromiseLike<Winner | Error>[] = Object.values<
    PromiseLike<Winner | Error>
  >(
    map<Sources, K, Record<K, PromiseLike<Winner | Error>>>(sources, ({ next }, key) =>
      next.then(
        frame => ({ key, frame }),
        error => new Error(error),
      ),
    ),
  )
  return Promise.any<readonly (Winner | Error)[], 0>(promises).then<Winner>(
    (result: Winner | Error) => {
      if (result instanceof Error) {
        throw result
      } else {
        return result
      }
    },
  )
}
