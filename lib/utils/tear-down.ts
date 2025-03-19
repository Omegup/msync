import type { Iterator, Frame } from '../types'

export const addTeardown = <T, Info>(it: Iterator<T, Info>, tr?: () => Promise<void>): Iterator<T, Info> => {
  if (!tr) return it
  return () => {
    const { next, stop, clear } = it()
    const n: PromiseLike<Frame<T, Info>> = next
    return {
      next: n.then(({ cont, ...res }) => ({ cont: addTeardown(cont, tr), ...res })),
      stop: () => (tr(), stop()),
      clear: async () => {
        await tr()
        await clear()
      },
    }
  }
}
