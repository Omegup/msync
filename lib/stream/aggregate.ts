import type { AggregateCommand } from '../types/aggregate'
import type { Db, ReadonlyCollection } from '../../types'
import type { RawStages } from '../types'
import { log } from '../utils/log'

export const aggregate = <Result>(
  db: Promise<Db>,
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
    log('exec', streamName, req)
    // if (state.steady) {
    //   return state.f({ input: req }).then(() => new Promise(res => {}))
    // }
    const start2 = Date.now()
    return db
      .then(d => d.command(req))
      .then(
        result => {
          log('prepare', streamName, Date.now() - start)
          log('prepare2', streamName, start2 - start)
          const r = result as AggregateCommand<Result>
          log(
            'execed',
            streamName,
            (replace: (s: string) => string) =>
              replace(
                JSON.stringify(req).replaceAll(
                  '"$$CLUSTER_TIME"',
                  JSON.stringify(r.cursor.atClusterTime),
                ),
              ),
            result,
            'took',
            Date.now() - start,
          )
          return r
        },
        async err => {
          log('err', req, err)
          console.error(err)
          await new Promise(() => {})
          throw new Error(err)
        },
      )
  })
