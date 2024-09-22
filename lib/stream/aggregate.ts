import type { Stages } from '../types'
import type { AggregateCommand } from '../types/aggregate'
import { log } from '../utils/log'

export const aggregate = <Result>(input: Stages<unknown, Result>) =>
  input(({ coll, exec, match }) => {
    const req = {
      aggregate: coll.collectionName,
      pipeline: [...match, ...exec],
      cursor: {},
      readConcern: { level: 'snapshot' },
    }
    log('exec', req)
    return coll.s.db.command(req).then(
      result => {
        log('execed', req)
        return result as AggregateCommand<Result>
      },
      err => {
        log('err', req)
        throw new Error(err)
      },
    )
  })
