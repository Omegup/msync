import type { Timestamp } from 'mongodb'
import type { JsonObj, O, View } from '../types'
import { $matchRaw, $projectRaw, $simpleMergeRaw } from './aggregate/$match-raw'
import { concatParts } from './aggregate/prefix'
import { root } from './field'
import { $gteTs } from './predicate'
import { aggregate } from './stream/aggregate'
import type {
  Delta,
  Query,
  RawStagesPart,
  Runner,
  SnapshotStream,
  SnapshotStreamExecutionResult,
  Working,
} from './types'

type TS = O<{ touchedAt: Timestamp; deletedAt?: Timestamp }>

const executes = <T extends JsonObj, Result extends JsonObj>(
  view: View<T & TS>,
  input: RawStagesPart<T, Result>,
  streamName: string,
): SnapshotStreamExecutionResult<Result> => {
  const { collection, projection } = view
  const db = collection.s.db,
    coll = collection.collectionName
  const last = db.collection<{ _id: string; ts: Timestamp }>('__last')
  const snapshotCollection = db.collection<Delta<T> & { updated: boolean }>(
    coll + '_' + streamName + '_snapshot',
  )
  // TODO create indexes (if snapshot is in sources)
  const projectInput = $projectRaw(projection)

  return {
    stages: c => c({ coll: snapshotCollection, stages: input }),
    run: <Result2 extends JsonObj>(
      finalInput: RawStagesPart<Result, Result2>,
    ): Runner<readonly Result2[], Working> => {
      return c => {
        async function f() {
          // Step 1 : empty new collection
          await snapshotCollection.deleteMany({ updated: true })
          // put this in the right place
          await snapshotCollection.deleteMany({ updated: true, after: null })
          await snapshotCollection.updateMany({ updated: true }, [
            { $set: { updated: false, after: null, before: '$after' } },
          ])

          //
          // Step 2 : clone into new collection
          const lastTS = await last.findOne({ _id: streamName })
          let startInput = projectInput
          if (lastTS) {
            const query: Query<T & TS> = root<TS>().of('touchedAt').has($gteTs(lastTS.ts))
            const matchTS = $matchRaw<T & TS>(query)
            startInput = concatParts(startInput, matchTS)
          }
          await collection
            .aggregate([
              { $match: { touchedAt: { $gte: lastTS!.ts } } },
              { $replaceWith: { after: '$$ROOT', updated: true, _id: '$_id' } },
              { $merge: { into: snapshotCollection.namespace } },
            ])
            .toArray()
          const cloneIntoNew = concatParts(startInput, $simpleMergeRaw<T>(snapshotCollection))
          const result = await aggregate<T>({
            db,
            input: c => c({ coll: collection, stages: cloneIntoNew }),
          })
          if (!result.ok) throw result.err
          // Step 3 : run the aggregation // idempotent
          const aggResult = await aggregate({
            db,
            input: c => c({ coll: newCollection, stages: concatParts(input, finalInput) }),
          })
          if (!aggResult.ok) throw aggResult.err
          // Step 4 : update snapshot aggregation (if snapshot is in sources)
          const resultSnapshot = await aggregate<T>({
            db,
            input: c => c({ coll: newCollection, stages: $simpleMergeRaw<T>(snapshotCollection) }),
          })
          // Step 5 : update __last
        }

        const runner: Runner<readonly Result[], Working> = {}
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

  //

  // while (true) {

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
