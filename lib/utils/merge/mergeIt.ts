import type { HKT, I, RORec } from '../../../types'
import type { Working } from '../../types'
import { id } from '../json'
import { makeMergeItResults, racer } from './merge'

interface WorkHKT extends HKT<Working> {
  readonly out: RORec<'work', I<Working, this>['work']>
}
const race = racer(id)
export const mergeItResults = makeMergeItResults<Working, WorkHKT, unknown>({
  info: (key, info) => ({ key: key, value: info, work: info.work }),
  buildWinner: id,
  nextWinner: async ({ frame: { info }, key, sources }, next) => {
    if (info.work) {
      // If the received iteration is a work, wait for it to complete before doing anything else.
      const frame = await next
      // If its resulting frame is about the same work, don't interrupt, hold with the same flow
      // This means we don't jump to another thread, maintaining the current execution context.
      if (info.work === frame.info.work) {
        return { frame, key, sources }
      }
      // else we will just race the sources again including the current one
      // if this current one wins the race it will be equivalent to the previous return
    }
    return race(sources)
  },
})
