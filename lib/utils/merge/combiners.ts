import { mergeIterators } from './merge'
import type { RORec } from '../../../types'
import type { Iterator, IteratorResult, HasJob } from '../../types'

const state = { steady: false }
let timeout: NodeJS.Timeout | null = null

export { mergeIterators } from './merge'

export const firstWorksMerge = <Result, Info extends HasJob>(
  iters: Iterator<Result, Info>[],
): Iterator<Result, { readonly key: string; readonly value: Info } & HasJob> => {
  const iterator = () => {
    const results = iters.map(iter => iter())
    const sources: Record<string, IteratorResult<Result, Info>> = Object.fromEntries(
      results.map((result, index) => [String(index), result]),
    )
    return mergeIterators<string, Result, RORec<string, Info>>({
      sources,
      // interrupt: key => key !== '0',
      interrupt: key => false,
      hooks: {
        start: (frame, result) => {
          if (!frame.info.job) return
          if (timeout !== null) {
            clearTimeout(timeout)
            timeout = null
          }
          result.next.then(() => {
            if (!frame.info.job) return
            if (!state.steady) {
              if (timeout !== null) clearTimeout(timeout)
              timeout = setTimeout(() => {
                state.steady = true
                console.log('steady')
              }, 2000)
            }
          })
        },
      },
    })
  }
  return iterator
}
