import type { Frame, IteratorResult, HasJob } from '../../types'
import { nextWinner } from './next-winner'
import type { KEYS, Race, RaceWinner, SourceIteratorResults, SourceResults } from './types'
import { patch, race, restart } from './utils'

export const mergeIterators = <K extends KEYS, Result, Info extends Record<K, HasJob>>(params: {
  sources: SourceIteratorResults<K, Result, Info>
  interrupt?: (key: KEYS) => boolean
  select?: Race<K, Result, Info>
}): IteratorResult<Result, SourceResults<K, Info>> => {
  type Sources = SourceIteratorResults<K, Result, Info>
  type Winner = RaceWinner<K, Result, Info>
  type CurFrame = Frame<Result, SourceResults<K, Info>>
  const { sources, interrupt, select = race } = params
  /**
   * Reiterates over the results, continuing the iteration process.
   * - `frame`: The resulting frame from the asynchronous source.
   * - `key`: The source key of the data.
   */
  const reiterate = (winner: Winner): CurFrame => {
    const { frame, key } = winner,
      result = frame.cont()
    return {
      cont: () =>
        mergeIterators<K, Result, Info>({
          sources: patch<Sources, K>(sources, key, result),
          interrupt,
          select: sources => nextWinner(winner, result.next, sources, interrupt),
        }),
      data: frame.data,
      info: { key, value: frame.info,  job: frame.info.job },
    }
  }
  // The main `IteratorResult` returned by `mergeItResults`.
  return {
    stop: () => mergeIterators({ sources: restart(sources), interrupt }),
    next: select(sources).then(reiterate),
  }
}
