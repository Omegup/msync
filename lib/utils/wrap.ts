import type { ConstHKT, RORec } from '../../types'
import type { Iterator, IteratorResult } from '../types'
import { makeMergeItResults } from './merge'

type UnkHKT = ConstHKT<unknown, unknown>
type First = { readonly first: boolean }
const combine = makeMergeItResults<unknown, UnkHKT, First>({
  info: (source, info) => ({ source, value: info }),
  makeNext: source => frame => ({ source, frame, first: true }),
  interceptor: (_, source, next) => raceSources => async sources => {
    if (source === '0') {
      // If the received iteration is a work, wait for it to complete before doing anything else.
      const frame = await next
      return { frame, source, first: false }
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
