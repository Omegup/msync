import { mergeIterators } from '.'
import type { RORec } from '../../../types'
import type { Iterator, IteratorResult, HasJob } from '../../types'

export { mergeIterators } from './merge'

export const firstWorksMerge = <Result, Info extends HasJob>(
  iters: Iterator<Result, Info>[],
): Iterator<Result, { readonly key: string; readonly value: Info } & HasJob> => {
  const iterator = () => {
    const results = iters.map(iter => iter())
    const sources: RORec<number, IteratorResult<Result, Info>> = { ...results }
    return mergeIterators<string, Result, RORec<string, Info>>({
      sources,
      // interrupt: key => key !== '0',
      interrupt: key => false,
    })
  }
  return iterator
}
