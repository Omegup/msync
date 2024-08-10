import type { Timestamp } from 'mongodb'
import type { JsonObj, View } from '../types'
import { $matchRaw, $projectRaw } from './aggregate/$match-raw'
import { concatRaw } from './aggregate/concat-raw'
import { root } from './field'
import { $eq, $gteTs } from './predicate'
import { $or } from './query/logic'
import { aggregate } from './stream/aggregate'
import type { Pipeline, RawStages, Runner, Stages, StagesMapper, Stream } from './types'

export type Sources = 'snapshot' | 'new'
export type PipelineParam<out Source extends Sources> = {
  source: Source
}

type TS = { touchedAt: Timestamp; deletedAt?: Timestamp }

async function* executes<T extends JsonObj & TS, Result extends JsonObj, Source extends Sources>(
  view: View<T>,
  input: Pipeline<T, Result, Source, never>,
  streamName: string,
  sourceMap: SourceMap<Source>,
): Runner<readonly Result[]> {
  const { collection, projection, match } = view
  const db = collection.s.db,
    coll = collection.collectionName
  const last = db.collection<{ _id: string; ts: Timestamp }>('__last')
  const newCollection = db.collection<T>(coll + '_' + streamName + '_new')
  const snapshotCollection = db.collection<T>(coll + '_' + streamName + '_snapshot')
  // TODO create indexes (if snapshot is in sources)
  const client = db.s.client ?? db.client
  const makeStages =
    <R, R_Param>(mapper: StagesMapper<T, R, Source, R_Param>): Stages<R, R_Param> => {
      return mapper(param => ({
        collection: param === 'new' ? newCollection : snapshotCollection,
        stages: [{ $project: 0 }],
      }))
    }

  const projectInput = $projectRaw<T, Source>(projection)

  while (true) {
    // Step 1 : empty new collection
    // Step 2 : clone into new collection
    // Step 3 : run the aggregation
    // Step 4 : update snapshot aggregation (if snapshot is in sources)
    // Step 5 : update __last

    const item = streamName ? await last.findOne({ _id: streamName }) : null
    const after = item?.ts
    let ss = projectInput
    if (after) {
      const field = root<TS>().of('touchedAt')
      const isAfter = $or(field.has($gteTs(after)), field.has($eq(null)))
      ss = concatRaw(projectInput, $matchRaw<T, Source>(isAfter))
    }
    const zzz = projectInput.stages(param => ({ stages: addTs(param, match), coll }))
    const response = await aggregate({
      db,
      input: zzz({
        source: param,
      }),
    })
    if (!response.ok) {
      await new Promise(res => setTimeout(res, 3000))
      continue
    }
    const doc = response.result
    const ts = doc.cursor.atClusterTime,
      { t, i } = ts.toExtendedJSON().$timestamp
  }
}

type SourceMap<Source extends Sources> = Record<Source, 1> & Partial<Record<Sources, 1>>

type Params<T extends JsonObj & { touchedAt: Timestamp }, Source extends Sources> = readonly [
  view: View<T>,
  streamName: string,
  sourceMap: SourceMap<Source>,
]

export const from = <T extends JsonObj & { touchedAt: Timestamp }, Source extends Sources>(
  ...[view, streamName, sourceMap]: Params<T, Source>
): Stream<T, Source> => ({
  execute: executionParam => executes(view, executionParam, streamName, sourceMap),
})
