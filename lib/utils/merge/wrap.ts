import type { ConstHKT, RORec } from '../../../types'
import type { Iterator, IteratorResult } from '../../types'
import { makeMergeItResults, patch, racer, restart } from './merge'

type UnkHKT = ConstHKT<unknown, unknown>
type First = { readonly first: boolean }
const race = racer<unknown, First>(winner => ({ ...winner, first: true }))
const combine = makeMergeItResults<unknown, UnkHKT, First>({
  info: (key, info) => ({ key, value: info }),
  race,
  intercept: async (winner, next, sources) => {
    if (winner.key === '0') {
      // If the received iteration is a work, wait for it to complete before doing anything else.
      const frame = await next
      if (winner.first) {
        const source = sources[winner.key]
        // restart all except this one
        sources = restart(patch(sources, winner.key, { ...source, stop: () => source }))
      }
      return { winner: { frame, key: winner.key, first: false }, sources }
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
