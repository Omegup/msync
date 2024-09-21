import type { Frame, IteratorResult, NextFrame, Working } from '../../types'
import type {
  InfoBuilder,
  KEYS,
  Race,
  RaceWinner,
  SourceIteratorResults,
  SourceResults,
} from './types'
import { patch, race, restart } from './utils'

const nextWinner = async <K extends KEYS, Result, Dom extends Record<K, Working>>(
  previousWinner: RaceWinner<K, Result, Dom>,
  nextFrame: NextFrame<Result, Dom[K]>,
  sources: SourceIteratorResults<K, Result, Dom>,
): Promise<RaceWinner<K, Result, Dom>> => {
  const { frame: previousFrame, key } = previousWinner
  if (previousFrame.info.work) {
    // If the received iteration is a work, wait for it to complete before doing anything else.
    const frame = await nextFrame
    // If its resulting frame is about the same work, don't interrupt, hold with the same flow
    // This means we don't jump to another thread, maintaining the current execution context.
    if (previousFrame.info.work === frame.info.work) {
      return { frame, key }
    }
    // else we will just race the sources again including the current one
    // if this current one wins the race it will be equivalent to the previous return
  }
  return race(sources)
}
export const merge = (buildInfo: InfoBuilder) => {
  const mergeItResults = <K extends KEYS, Result, Dom extends Record<K, Working>>(
    sources: SourceIteratorResults<K, Result, Dom>,
    select: Race<K, Result, Dom> = race,
  ): IteratorResult<Result, SourceResults<K, Dom>> => {
    type Sources = SourceIteratorResults<K, Result, Dom>
    type Winner = RaceWinner<K, Result, Dom>
    type CurFrame = Frame<Result, SourceResults<K, Dom>>
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
          mergeItResults<K, Result, Dom>(patch<Sources, K>(sources, key, result), sources =>
            nextWinner(winner, result.next, sources),
          ),
        data: frame.data,
        info: buildInfo(key, frame.info),
      }
    }
    // The main `IteratorResult` returned by `mergeItResults`.
    return {
      stop: () => mergeItResults(restart(sources)),
      next: select(sources).then(reiterate),
    }
  }
  return mergeItResults
}
