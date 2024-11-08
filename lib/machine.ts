import type { Iterator, IteratorResult, HasJob } from './types'
import { firstWorksMerge } from './utils/merge/combiners'

export class Machine<Result> {
  private sources: Iterator<Result, HasJob>[]

  constructor(root?: Iterator<Result, HasJob>) {
    this.sources = root ? [root] : []
  }

  add(x: Iterator<Result, HasJob>): void {
    this.sources.push(x)
  }

  runner(): Iterator<Result, HasJob> {
    const items = this.sources.filter(x => x)
    if (items.length === 1) {
      return items[0]
    }
    return firstWorksMerge<Result, HasJob>(items)
  }

  start(cb?: (info: HasJob) => void): Promise<never> {
    const run = this.runner()
    return runCont(run(), cb)
  }
}

export const wrap = <Result>(root: Machine<Result>): Machine<Result> => new Machine(root.runner())

const runCont = async <T, Info>(
  { next }: IteratorResult<T, Info>,
  cb?: (info: Info) => void,
): Promise<never> => {
  const { cont, info } = await next
  cb?.(info)
  return runCont(cont(), cb)
}
