import type { HKT, I, RORec } from '../../types'
import type { Working } from '../types'
import { makeMergeItResults } from './merge'

interface WorkHKT extends HKT<Working> {
  readonly out: RORec<'work', I<Working, this>['work']>
}
export const mergeItResults = makeMergeItResults<Working, WorkHKT, unknown>({
  info: (source, info) => ({ source, value: info, work: info.work }),
  makeNext: source => frame => ({ source, frame }),
  interceptor:
    ({ work }, source, next) =>
    raceSources =>
    async sources => {
      if (work) {
        // If the received iteration is a work, wait for it to complete before doing anything else.
        const frame = await next
        // If its resulting frame is about the same work, don't interrupt, hold with the same flow
        // This means we don't jump to another thread, maintaining the current execution context.
        if (work === frame.info.work) {
          return { frame, source }
        }
        // else we will just race the sources again including the current one
        // if this current one wins the race it will be equivalent to the previous return
      }
      return raceSources(sources)
    },
})
