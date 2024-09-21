import type { HKT } from '../../../types'
import type { Frame, IteratorResult, NextFrame } from '../../types'
import type {
  FSourceResults,
  GRace,
  KEYS,
  Race,
  RaceWinner,
  RaceWinnerAndSources,
  SourceIteratorResults,
} from './types'
import { patch, restart } from './utils'

export const makeMergeItResults = <W, F extends HKT<W>, WinnerExtra = unknown>(params: {
  winner: <K extends KEYS, Result, Dom extends Record<K, W>>(
    previousWinner: RaceWinner<K, Result, Dom> & WinnerExtra,
    nextFrame: NextFrame<Result, Dom[K]>,
    sources: SourceIteratorResults<K, Result, Dom>,
  ) => PromiseLike<RaceWinnerAndSources<K, Result, Dom, WinnerExtra>>
  info: <K extends KEYS, Dom extends Record<K, W>>(
    key: K,
    info: Dom[K],
  ) => FSourceResults<K, W, F, Dom>
  race: GRace<W, WinnerExtra>
}) => {
  const { info, winner: getWinner, race: defaultRace } = params
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
            getWinner(winner, result.next, sources),
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
