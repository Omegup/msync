import type { AggregateCommand } from '../types/aggregate'
import type { ReadonlyCollection } from '../../types'
import type { RawStages } from '../types'
import { log } from '../utils/log'

export const state = { steady: false }
let timeout: NodeJS.Timeout | null = null

export const aggregate = <Result>(
  streamName: string,
  input: <E>(
    consume: <S, B>(value: {
      coll: ReadonlyCollection<S>
      input: RawStages<unknown, B, Result>
    }) => E,
  ) => E,
  snapshot = true,
  start = Date.now(),
) =>
  input<Promise<AggregateCommand<Result>>>(({ coll, input }) => {
    const req = {
      aggregate: coll.collectionName,
      pipeline: input,
      cursor: {},
      ...(snapshot && { readConcern: { level: 'snapshot' } }),
    }
    if (timeout !== null) {
      clearTimeout(timeout)
      timeout = null
    }
    log('exec', streamName, req)
    return coll.s.db.command(req).then(
      result => {
        const r = result as AggregateCommand<Result>
        log(
          'execed',
          streamName,
          (replace: (s: string) => string) =>
            replace(
              JSON.stringify(req).replaceAll(
                '$$CLUSTER_TIME',
                JSON.stringify(r.cursor.atClusterTime),
              ),
            ),
          result,
          'took',
          Date.now() - start,
        )
        if (!state.steady) {
          if (timeout !== null) throw new Error('timeout should be null')
          timeout = setTimeout(() => {
            state.steady = true
            console.log('steady')
          }, 10000)
        }
        return r
      },
      err => {
        log('err', req, err)
        throw new Error(err)
      },
    )
  })
