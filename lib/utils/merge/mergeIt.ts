import type { HKT, I, RORec } from '../../../types'
import type { Working } from '../../types'
import { id } from '../json'
import { makeMergeItResults } from './merge'
import type { FSourceResults } from './types'
import { racer } from './utils'

export interface WorkHKT extends HKT<Working> {
  readonly out: RORec<'work', I<Working, this>['work']>
}
const race = racer(id)

export type Info = <K extends string, Dom extends Record<K, Working>>(
  key: K,
  info: Dom[K],
) => FSourceResults<K, Working, WorkHKT, Dom>

export const mergeIt = (info: Info) =>
  makeMergeItResults<Working, WorkHKT, unknown>({
    info,
    race,
    winner: async (previousWinner, nextFrame, sources) => {
      const { frame: previousFrame, key } = previousWinner
      if (previousFrame.info.work) {
        // If the received iteration is a work, wait for it to complete before doing anything else.
        const frame = await nextFrame
        // If its resulting frame is about the same work, don't interrupt, hold with the same flow
        // This means we don't jump to another thread, maintaining the current execution context.
        if (previousFrame.info.work === frame.info.work) {
          return { winner: { frame, key }, sources }
        }
        // else we will just race the sources again including the current one
        // if this current one wins the race it will be equivalent to the previous return
      }
      return race(sources)
    },
  })

const info: Info = (key, info) => ({ key, value: info, work: info.work })
export const mergeItResults = mergeIt(info)