import type { JsonObj } from '../../types'
import type { Field } from '../field'
import type { Query, RawStagesSource } from '../types'
import { id } from '../utils/json'
import { asRowPart } from './prefix'

export const $matchRaw = <T extends JsonObj>(query: Query<T>) =>
  asRowPart<T, T>([{ $match: query.raw(id) }])

export const $projectRaw = <T>(projection: Record<keyof T, 1>) =>
  asRowPart<T, T>([{ $project: projection }])

export const $lookupRaw = <
  T extends JsonObj,
  U extends JsonObj,
  R,
  S,
  K1 extends string,
  K2 extends string,
>(
  { foreignField, localField }: { foreignField: Field<U, S>; localField: Field<T, S> },
  { stages, coll }: RawStagesSource<R, U>,
  k1: K1,
  k2: K2,
) =>
  asRowPart<T, Record<K1, T> & Record<K2, U>>([
    {
      $replaceWith: { [k1]: '$ROOT' },
    },
    {
      $lookup: {
        from: coll.collectionName,
        as: k2,
        let: { [k1]: `$${k1}.${localField.field}` },
        pipeline: [{ $match: { $expr: { $eq: ['$$left_id', '$_id'] } } }, ...stages],
      },
    },
    { $unwind: { path: '$right', preserveNullAndEmptyArrays: true } },
  ])
