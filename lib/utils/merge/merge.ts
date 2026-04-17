import type { Frame, IteratorResult, HasJob, NextFrame } from '../../types'
import { nextWinner } from './next-winner'
import type { KEYS, Race, RaceWinner, SourceIteratorResults, SourceResults } from './types'
import { patch, race, restart } from './utils'

const makeSelect =
  <K extends KEYS, Result, Info extends Record<K, HasJob>>(
    winner: RaceWinner<K, Result, Info>,
    nextFrame: NextFrame<Result, Info[K]>,
    interrupt?: (key: KEYS) => boolean,
  ): Race<K, Result, Info> =>
  sources =>
    nextWinner(winner, nextFrame, sources, interrupt)

const makeContinuation =
  <K extends KEYS, Result, Info extends Record<K, HasJob>>(
    sources: SourceIteratorResults<K, Result, Info>,
    winner: RaceWinner<K, Result, Info>,
    interrupt?: (key: KEYS) => boolean,
    hooks?: {
      start?: (frame: Frame<Result, Info[K]>, result: IteratorResult<Result, Info[K]>) => void
    },
  ) =>
  () => {
    const { frame, key } = winner
    const result = frame.cont()
    hooks?.start?.(frame, result)
    return mergeIterators<K, Result, Info>({
      sources: patch<SourceIteratorResults<K, Result, Info>, K>(sources, key, result),
      interrupt,
      select: makeSelect(winner, result.next, interrupt),
      hooks,
    })
  }
/**
 * Reiterates over the results, continuing the iteration process.
 * - `frame`: The resulting frame from the asynchronous source.
 * - `key`: The source key of the data.
 */
const makeReiterate =
  <K extends KEYS, Result, Info extends Record<K, HasJob>>(
    sources: SourceIteratorResults<K, Result, Info>,
    interrupt?: (key: KEYS) => boolean,
    hooks?: {
      start?: (frame: Frame<Result, Info[K]>, result: IteratorResult<Result, Info[K]>) => void
    },
  ) =>
  (winner: RaceWinner<K, Result, Info>): Frame<Result, SourceResults<K, Info>> => {
    const { frame, key } = winner
    return {
      cont: makeContinuation(sources, winner, interrupt, hooks),
      data: frame.data,
      info: { key, value: frame.info, job: frame.info.job },
    }
  }

export const mergeIterators = <K extends KEYS, Result, Info extends Record<K, HasJob>>(params: {
  sources: SourceIteratorResults<K, Result, Info>
  interrupt?: (key: KEYS) => boolean
  select?: Race<K, Result, Info>
  hooks?: {
    start?: (frame: Frame<Result, Info[K]>, result: IteratorResult<Result, Info[K]>) => void
  }
}): IteratorResult<Result, SourceResults<K, Info>> => {
  const { sources, interrupt, select = race, hooks } = params
  // The main `IteratorResult` returned by `mergeItResults`.
  return {
    stop: () => mergeIterators({ sources: restart(sources), interrupt, select, hooks }),
    next: select(sources).then(makeReiterate(sources, interrupt, hooks)),
    clear: async () => {
      for (const key in sources) {
        await sources[key].clear()
      }
    },
  }
}
