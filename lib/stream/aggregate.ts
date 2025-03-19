import type { AggregateCommand } from '../types/aggregate'
import type { ReadonlyCollection } from '../../types'
import type { RawStages } from '../types'
import { log } from '../utils/log'

export const aggregate = <Result>(
  input: <E>(
    consume: <S, B>(value: {
      coll: ReadonlyCollection<S>
      input: RawStages<unknown, B, Result>
    }) => E,
  ) => E,
  snapshot = true,
  start = Date.now()
) =>
  input<Promise<AggregateCommand<Result>>>(({ coll, input }) => {
    const req = {
      aggregate: coll.collectionName,
      pipeline: input,
      cursor: {},
      ...(snapshot && { readConcern: { level: 'snapshot' } }),
    }
    log('exec', req)
    return coll.s.db.command(req).then(
      result => {
        log('execed', req, result, 'took', Date.now() - start)
        return result as AggregateCommand<Result>
      },
      err => {
        log('err', req, err)
        throw new Error(err)
      },
    )
  })
