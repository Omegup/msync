import { Db } from 'mongodb'
import type { JsonObj } from '../../types'
import type { RawStages } from '../types'
import type { AggregateCommand } from '../types/aggregate'
import { log } from '../utils/log'

export const aggregate = <Result extends JsonObj>({
  db,
  comment,
  input,
}: {
  db: Db
  comment: string
  input: RawStages
}) => {
  const req = {
    aggregate: input.coll,
    pipeline: input.stages,
    comment,
    cursor: {},
    readConcern: { level: 'snapshot' },
  }
  log('exec', req)
  return db.command(req).then(
    result => {
      log('executed', req, result)
      return { result: result as AggregateCommand<Result>, ok: true as const }
    },
    err => {
      log('err', req, err)
      return { err, ok: false as const }
    },
  )
}
