import type { RORec } from '../../../types'
import type { Iterator, IteratorResult, Working } from '../../types'
import { mergeIt, type Info } from './mergeIt'


const info: Info = (key, info) => ({ key, value: info, work: key === '0' ? info.work : undefined })
export const combine =  mergeIt(info)

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
