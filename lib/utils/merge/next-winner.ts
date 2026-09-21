import type { NextFrame, HasJob } from '../../types'
import type { KEYS, RaceWinner, SourceIteratorResults } from './types'
import { race } from './utils'

export const nextWinner = <K extends KEYS, Result, Info extends Record<K, HasJob>>(
  previousWinner: RaceWinner<K, Result, Info>,
  previousWinnerNextFrame: NextFrame<Result, Info[K]>,
  sources: SourceIteratorResults<K, Result, Info>,
  interrupt?: (key: KEYS) => boolean
): PromiseLike<RaceWinner<K, Result, Info>> => {
  const { frame: previousFrame, key } = previousWinner
  // If we have a non interruptable job, we will wait for it to complete before doing anything else
  if (!interrupt?.(key) && previousFrame.info.job) {
    // If the received iteration is a job, wait for it to complete before doing anything else.
    return previousWinnerNextFrame.then((previousFrameSuccessor)=>{
      
      // If its resulting frame is still a job, don't interrupt, hold with the same flow
      // This means we don't jump to another thread, maintaining the current execution context.
      if (previousFrameSuccessor.info.job) {
        return { frame: previousFrameSuccessor, key }
      }
      // else we will just race the sources again including the current one
      // if this current one wins the race it will be equivalent to the previous return
      return race(sources)
    })
  }
  return race(sources)
}
