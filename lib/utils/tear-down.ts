import type { Iterator, Frame } from '../types'

export const addTeardown = <T, Dom>(it: Iterator<T, Dom>, tr?: () => void): Iterator<T, Dom> => {
  if (!tr) return it
  return () => {
    const { next, stop } = it()
    const n: PromiseLike<Frame<T, Dom>> = next
    return {
      next: n.then(({ cont, ...res }) => ({ cont: addTeardown(cont, tr), ...res })),
      stop: () => (tr(), stop()),
    }
  }
}
