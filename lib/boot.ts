import type { Timestamp } from 'mongodb'
import type { ID, JsonObj, O, View, doc } from '../types'
import { $matchRaw, $projectRaw, $replaceWith, $simpleMergeRaw } from './aggregate/$match-raw'
import { concatParts } from './aggregate/prefix'
import { field } from './expression/concat'
import { eq, ite } from './expression/logic'
import { val } from './expression/val'
import { root } from './field'
import { $eq, $gteTs, $ne } from './predicate'
import { $and } from './query/logic'
import { aggregate } from './stream/aggregate'
import type {
  Delta,
  Query,
  RawStagesPart,
  Runner,
  SnapshotStream,
  SnapshotStreamExecutionResult,
  UDelta,
  Working,
} from './types'

type D = O<{ deletedAt: Timestamp | undefined }>
type TS = D & { touchedAt: Timestamp }

const executes = <T extends doc, Result extends JsonObj, V extends T & TS & JsonObj>(
  view: View<T & D, V>,
  input: RawStagesPart<Delta<T>, Delta<Result>>,
  streamName: string,
): SnapshotStreamExecutionResult<Result> => {
  const { collection, projection, hardMatch, match } = view
  const db = collection.s.db,
    coll = collection.collectionName
  const last = db.collection<{ _id: string; ts: Timestamp }>('__last')
  const snapshotCollection = db.collection<UDelta<T>>(coll + '_' + streamName + '_snapshot')
  // TODO create indexes (if snapshot is in sources)
  const projectInput = $projectRaw<T & D>({ ...projection, deletedAt: 1 })

  const isNew = (isNew: boolean): Query<UDelta<T>> =>
    root<UDelta<T>>().of('updated').has($eq<boolean>(isNew))

  return {
    stages: c =>
      c({ coll: snapshotCollection, stages: concatParts($matchRaw(isNew(false)), input) }),
    run: <Result2 extends JsonObj>(
      finalInput: RawStagesPart<Delta<Result>, Result2>,
    ): Runner<readonly Result2[], Working> => {
      return c => {
        async function f() {
          // Step 1 : empty new collection
          await snapshotCollection.deleteMany({ updated: true })

          // Step 2 : clone into new collection
          const lastTS = await last.findOne({ _id: streamName })
          const hardQuery = $and(
            lastTS && root<TS>().of('touchedAt').has($gteTs(lastTS.ts)),
            hardMatch,
          )
          const startInput: RawStagesPart<V, T & D> = hardQuery
            ? concatParts($matchRaw(hardQuery), projectInput)
            : projectInput
          const notDeleted = root<D>().of('deletedAt').has($ne<Timestamp | null | undefined>(null))
          const replaceRaw = $replaceWith(
            field<T & D, Omit<Delta<T>, 'before'> & { updated: true }>({
              after: ite(
                $and(notDeleted, match).expr(root()),
                root<T>(),
                val(() => null),
              ),
              updated: val(() => true),
              _id: root<ID>().of('_id'),
            }),
          )
          const cloneIntoNew = concatParts(
            concatParts(startInput, replaceRaw),
            $simpleMergeRaw<Delta<T>, 'after'>(snapshotCollection),
          )
          const result = await aggregate<T>(c => c({ coll: collection, stages: cloneIntoNew }))
          if (!result.ok) throw result.err

          // Step 3 : run the aggregation // idempotent
          const aggResult = await aggregate(c =>
            c({
              coll: snapshotCollection,
              stages: concatParts(concatParts($matchRaw(isNew(false)), input), finalInput),
            }),
          )
          if (!aggResult.ok) throw aggResult.err
          // Step 4 : update snapshot aggregation (if snapshot is in sources)
          await snapshotCollection.deleteMany({ updated: true, after: null })
          await snapshotCollection.updateMany({ updated: true }, [
            { $set: { updated: false, after: null, before: '$after' } },
          ])
          // Step 5 : update __last
          await last.updateOne(
            { _id: streamName },
            { $set: { ts: result.result.cursor.atClusterTime } },
            { upsert: true },
          )
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

type Params<T extends doc, V extends T & TS & JsonObj> = readonly [
  view: View<T & D, V>,
  streamName: string,
]

export const from =
  <T extends doc, V extends T & TS & JsonObj>(
    ...[view, streamName]: Params<T, V>
  ): SnapshotStream<T> =>
  executionParam =>
    executes(view, executionParam, streamName)
