import type { Iterator, IteratorResult, Working } from './types'
import { firstWorksMerge } from './utils/merge/combiners'

export class Machine<Result> {
  private sources: Iterator<Result, Working>[]

  constructor(root?: Iterator<Result, Working>) {
    this.sources = root ? [root] : []
  }

  add(x: Iterator<Result, Working>): void {
    this.sources.push(x)
  }

  runner(): Iterator<Result, Working> {
    const items = this.sources.filter(x => x)
    if (items.length === 1) {
      return items[0]
    }
    return firstWorksMerge<Result, Working>(this.sources)
  }

  start(cb: (info: Working) => void): Promise<never> {
    const run = this.runner()
    return runCont(run(), cb)
  }
}

export const wrap = <Result>(root: Machine<Result>): Machine<Result> => new Machine(root.runner())

const runCont = async <T, Dom>(
  { next }: IteratorResult<T, Dom>,
  cb: (info: Dom) => void,
): Promise<never> => {
  const { cont, info } = await next
  cb(info)
  return runCont(cont(), cb)
}
