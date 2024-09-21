import { mergeIterators } from '.'
import type { RORec } from '../../../types'
import type { Iterator, IteratorResult, HasJob } from '../../types'

export { mergeIterators } from './merge'

export const firstWorksMerge = <Result, Dom extends HasJob>(
  iters: Iterator<Result, Dom>[],
): Iterator<Result, { readonly key: string; readonly value: Dom } & HasJob> => {
  const iterator = () => {
    const results = iters.map(iter => iter())
    const sources: RORec<number, IteratorResult<Result, Dom>> = { ...results }
    return mergeIterators<string, Result, RORec<string, Dom>>({
      sources,
      interrupt: key => key !== '0',
    })
  }
  return iterator
}
