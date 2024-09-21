import { mergeIterators } from '.'
import type { RORec } from '../../../types'
import type { Iterator, IteratorResult, Working } from '../../types'

export { mergeIterators } from './merge'

export const firstWorksMerge = <Result, Dom extends Working>(
  iters: Iterator<Result, Dom>[],
): Iterator<Result, { readonly key: string; readonly value: Dom } & Working> => {
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
