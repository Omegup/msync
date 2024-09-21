import { merge } from './merge'
import type { RORec } from '../../../types'
import type { Iterator, IteratorResult, Working } from '../../types'

export const mergeItResults = merge((key, info) => ({ key, value: info, work: info.work }))

const combine = merge((key, info) => ({
  key,
  value: info,
  work: key === '0' ? info.work : undefined,
}))

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
