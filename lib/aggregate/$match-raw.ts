import type { JsonObj } from '../../types'
import type { Pipeline, Query } from '../types'
import { id } from '../utils/json'
import { appendStages, asRowPart } from './prefix'

export const $matchRaw = <T extends JsonObj, Param>(query: Query<T>): Pipeline<T, T, Param> => ({
  stages: appendStages(asRowPart<T, T>([{ $match: query.raw(id) }])),
})

export const $projectRaw = <T extends JsonObj, Param>(
  projection: Record<keyof T, 1>,
): Pipeline<T, T, Param> => ({
  stages: appendStages(asRowPart<T, T>([{ $project: projection }])),
})
