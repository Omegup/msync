import type { ConstHKT, RORec } from '../../../types'
import type { Iterator, IteratorResult, Working } from '../../types'
import { id } from '../json'
import { makeMergeItResults, patch, racer, restart } from './merge'
import type { WorkHKT } from './mergeIt'

type First = { readonly first: boolean }
// const race = racer<Working, First>(winner => ({ ...winner, first: true }))
// const combine = makeMergeItResults<Working, WorkHKT, First>({
//   info: (key, info) => ({ key, value: info, work: key === '0' ? info.work : undefined }),
//   race,
//   intercept: async (winner, next, sources) => {
//     if (winner.frame.info.work) {
//       // If the received iteration is a work, wait for it to complete before doing anything else.
//       const frame = await next
//       if (winner.first) {
//         const source = sources[winner.key]
//         // restart all except this one
//         sources = restart(patch(sources, winner.key, { ...source, stop: () => source }))
//       }
//       return { winner: { frame, key: winner.key, first: false }, sources }
//     }
//     return race(sources)
//   },
// })

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

export const wrap = <Result, Dom>(
  ...iters: Iterator<Result, Dom>[]
): Iterator<Result, { readonly key: string; readonly value: Dom }> => {
  const iterator = () => {
    const sources = iters.map(iter => iter())
    const asObject: RORec<number, IteratorResult<Result, Dom>> = { ...sources }
    return combine<string, Result, RORec<string, Dom>>(asObject)
  }
  return iterator
}
