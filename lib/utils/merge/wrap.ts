import type { ConstHKT, RORec } from '../../../types'
import type { Iterator, IteratorResult } from '../../types'
import { makeMergeItResults, patch, restart } from './merge'

type UnkHKT = ConstHKT<unknown, unknown>
type First = { readonly first: boolean }
const combine = makeMergeItResults<unknown, UnkHKT, First>({
  info: (key, info) => ({ key, value: info }),
  buildWinner: winner => ({ ...winner, first: true }),
  interceptor: (winner, next) => raceSources => async sources => {
    if (winner.key === '0') {
      // If the received iteration is a work, wait for it to complete before doing anything else.
      const frame = await next
      if (winner.first) {
        const source = sources[winner.key]
        patch(sources, winner.key, { ...source, stop: () => source })
        sources = restart(sources)
      }
      return { frame, key: winner.key, first: false, sources }
    }
    return raceSources(sources)
  },
})

export const wrap = <Result, Dom>(
  ...iters: Iterator<Result, Dom>[]
): Iterator<Result, { readonly source: string; readonly value: Dom }> => {
  const iterator = () => {
    const sources = iters.map(iter => iter())
    const asObject: RORec<number, IteratorResult<Result, Dom>> = { ...sources }
    return combine<string, Result, RORec<string, Dom>>(asObject)
  }
  return iterator
}
