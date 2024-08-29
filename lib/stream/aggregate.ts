import type { JsonObj } from '../../types'
import type { Stages } from '../types'
import type { AggregateCommand } from '../types/aggregate'
import { log } from '../utils/log'

export const aggregate = <Result extends JsonObj>(input: Stages<Result>) =>
  input(({ coll, stages }) => {
    const req = {
      aggregate: coll.collectionName,
      pipeline: stages,
      cursor: {},
      readConcern: { level: 'snapshot' },
    }
    log('exec', req)
    return coll.s.db.command(req).then(
      result => {
        return { result: result as AggregateCommand<Result>, ok: true as const }
      },
      err => {
        log('err', req, err)
        return { err, ok: false as const }
      },
    )
  })
