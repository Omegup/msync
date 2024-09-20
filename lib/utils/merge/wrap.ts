import type { RORec } from '../../../types'
import type { Iterator, IteratorResult, Working } from '../../types'
import { id } from '../json'
import { makeMergeItResults, racer } from './merge'
import type { WorkHKT } from './mergeIt'

const race = racer(id)

export const combine = makeMergeItResults<Working, WorkHKT, unknown>({
  info: (key, info) => ({ key, value: info, work: key === '0' ? info.work : undefined }),
  race,
  intercept: async ({ frame: { info }, key }, next, sources) => {
    if (info.work) {
      // If the received iteration is a work, wait for it to complete before doing anything else.
      const frame = await next
      // If its resulting frame is about the same work, don't interrupt, hold with the same flow
      // This means we don't jump to another thread, maintaining the current execution context.
      if (info.work === frame.info.work) {
        return { winner: { frame, key }, sources }
      }
      // else we will just race the sources again including the current one
      // if this current one wins the race it will be equivalent to the previous return
    }
    return race(sources)
  },
})

export const wrap = <Result, Dom extends Working>(
  ...iters: Iterator<Result, Dom>[]
): Iterator<Result, { readonly key: string; readonly value: Dom }> => {
  const iterator = () => {
    const sources = iters.map(iter => iter())
    const asObject: RORec<number, IteratorResult<Result, Dom>> = { ...sources }
    return combine<string, Result, RORec<string, Dom>>(asObject)
  }
  return iterator
}
