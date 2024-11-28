import type { Stages } from '../types'
import type { AggregateCommand } from '../types/aggregate'
import { log } from '../utils/log'

export const aggregate = <Result>(input: Stages<unknown, Result, unknown>) =>
  input(({ coll, exec, input }) => {
    const req = {
      aggregate: coll.collectionName,
      pipeline: [...input, ...exec],
      cursor: {},
      readConcern: { level: 'snapshot' },
    }
    log('exec', req)
    const start = Date.now()
    return coll.s.db.command(req).then(
      result => {
        log('execed', req, result, 'took', Date.now() - start)
        return result as AggregateCommand<Result>
      },
      err => {
        log('err', req)
        throw new Error(err)
      },
    )
  })
