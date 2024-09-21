import type { NextFrame, HasJob } from '../../types'
import type { KEYS, RaceWinner, SourceIteratorResults } from './types'
import { race } from './utils'

export const nextWinner = async <K extends KEYS, Result, Info extends Record<K, HasJob>>(
  previousWinner: RaceWinner<K, Result, Info>,
  nextFrame: NextFrame<Result, Info[K]>,
  sources: SourceIteratorResults<K, Result, Info>,
): Promise<RaceWinner<K, Result, Info>> => {
  const { frame: previousFrame, key } = previousWinner
  if (previousFrame.info.job) {
    // If the received iteration is a job, wait for it to complete before doing anything else.
    const frame = await nextFrame
    // If its resulting frame is about the same job, don't interrupt, hold with the same flow
    // This means we don't jump to another thread, maintaining the current execution context.
    if (previousFrame.info.job === frame.info.job) {
      return { frame, key }
    }
    // else we will just race the sources again including the current one
    // if this current one wins the race it will be equivalent to the previous return
  }
  return race(sources)
}
