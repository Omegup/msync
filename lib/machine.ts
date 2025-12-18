import type { Iterator, HasJob } from './types'
import { firstWorksMerge } from './utils/merge/combiners'

export class Machine<Result = unknown> {
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

  start(cb?: (info: HasJob) => void | boolean): Promise<never> {
    const run = this.runner()
    return runCont(run, cb)
  }
}

export const wrap = <Result>(root: Machine<Result>): Machine<Result> => root

const runCont = async <T, Info>(
  it: Iterator<T, Info>,
  cb?: (info: Info) => void | boolean,
): Promise<never> => {
  while (true) {
    const { next, stop, clear } = it()
    const res = await next.then(
      next => ({ ok: true, next }) as const,
      err => ({ ok: false, err }) as const,
    )
    if (!res.ok) {
      console.error(res.err)
      process.exit(1)
    }
    const { cont, info } = res.next
    if (cb?.(info)) {
      await clear()
      throw new Error('Machine stopped')
    }
    it = cont
  }
}
