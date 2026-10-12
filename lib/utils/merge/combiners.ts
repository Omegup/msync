import { mergeIterators } from './merge'
import type { Iterator, IteratorResult, HasJob } from '../../types'
import type { PRRec } from '../../../types';

const state = { steady: false }
let timeout: NodeJS.Timeout | null = null

export { mergeIterators } from './merge'

type ArrK<Arr extends readonly unknown[]> = Extract<keyof Arr, `${number}`>

export const firstWorksMerge = <Result, Info extends HasJob, Arr extends Iterator<Result, Info>[]>(
  iters: Arr,
): Iterator<Result, { readonly key: ArrK<Arr>; readonly value: Info } & HasJob> => {
  const iterator = () => {
    const results: {[K in keyof Arr]: IteratorResult<Result, Info>} = iters.map<Arr, IteratorResult<Result, Info>>(iter => iter())
   
    type K = ArrK<Arr> 
    const sources: PRRec<K, IteratorResult<Result, Info>> = Object.fromEntries(
      results.map((result, index) => [String(index) as K, result]),
    )
    return mergeIterators<K, Result, Record<K, Info>>({
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
