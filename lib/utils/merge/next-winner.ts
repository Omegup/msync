import type { NextFrame, Working } from '../../types'
import type { KEYS, RaceWinner, SourceIteratorResults } from './types'
import { race } from './utils'

export const nextWinner = async <K extends KEYS, Result, Dom extends Record<K, Working>>(
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
