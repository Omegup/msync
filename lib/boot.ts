import type { Timestamp } from 'mongodb'
import type { JsonObj, View } from '../types'
import { $matchRaw, $projectRaw } from './aggregate/$match-raw'
import { concatRaw } from './aggregate/concat-raw'
import { root } from './field'
import { $eq, $gteTs } from './predicate'
import { $or } from './query/logic'
import { aggregate } from './stream/aggregate'
import type { SnapshotStreamExecutionResult, SnapshotStream, RawStagesPart, Runner } from './types'

type TS = { touchedAt: Timestamp; deletedAt?: Timestamp }

const executes = <T extends JsonObj & TS, Result extends JsonObj>(
  view: View<T>,
  input: RawStagesPart<T, Result>,
  streamName: string,
): SnapshotStreamExecutionResult<Result> => {
  const { collection, projection, match } = view
  const db = collection.s.db,
    coll = collection.collectionName
  const last = db.collection<{ _id: string; ts: Timestamp }>('__last')
  const newCollection = db.collection<T>(coll + '_' + streamName + '_new')
  const snapshotCollection = db.collection<T>(coll + '_' + streamName + '_snapshot')
  // TODO create indexes (if snapshot is in sources)
  const client = db.s.client ?? db.client

  return {
    stages: c => c({ coll: snapshotCollection, stages: input }),
    run: <Result2 extends JsonObj>(input: RawStagesPart<Result, Result2>): Runner<readonly Result2[]> => {
      return c => {
        const runner: Runner<readonly Result[], unknown> = {}
        return c({
          cont: 0,
          data: 0,
          next: 0,
          stop: 0,
        })
      }
    },
  }
  // const makeStages = <R, R_Param>(
  //   mapper: StagesMapper<T, R, Source, R_Param>,
  // ): Stages<R, R_Param> => {
  //   return mapper(param => ({
  //     collection: param === 'new' ? newCollection : snapshotCollection,
  //     stages: [{ $project: 0 }],
  //   }))
  // }

  // const projectInput = $projectRaw<T, Source>(projection)

  // while (true) {
  //   // Step 1 : empty new collection
  //   // Step 2 : clone into new collection
  //   // Step 3 : run the aggregation
  //   // Step 4 : update snapshot aggregation (if snapshot is in sources)
  //   // Step 5 : update __last

  //   const item = streamName ? await last.findOne({ _id: streamName }) : null
  //   const after = item?.ts
  //   let ss = projectInput
  //   if (after) {
  //     const field = root<TS>().of('touchedAt')
  //     const isAfter = $or(field.has($gteTs(after)), field.has($eq(null)))
  //     ss = concatRaw(projectInput, $matchRaw<T, Source>(isAfter))
  //   }
  //   const zzz = projectInput.stages(param => ({ stages: addTs(param, match), coll }))
  //   const response = await aggregate({
  //     db,
  //     input: zzz({
  //       source: param,
  //     }),
  //   })
  //   if (!response.ok) {
  //     await new Promise(res => setTimeout(res, 3000))
  //     continue
  //   }
  //   const doc = response.result
  //   const ts = doc.cursor.atClusterTime,
  //     { t, i } = ts.toExtendedJSON().$timestamp
  // }
}

type Params<T extends JsonObj & { touchedAt: Timestamp }> = readonly [
  view: View<T>,
  streamName: string,
]

export const from =
  <T extends JsonObj & { touchedAt: Timestamp }>(
    ...[view, streamName]: Params<T>
  ): SnapshotStream<T> =>
  executionParam =>
    executes(view, executionParam, streamName)
