import type { JsonObj } from '../../types'
import type { Field } from '../field'
import type { Query, RawStagesSource } from '../types'
import { id } from '../utils/json'
import { asRawPart } from './prefix'

export const $matchRaw = <T extends JsonObj>(query: Query<T>) =>
  asRawPart<T, T>([{ $match: query.raw(id) }])

export const $projectRaw = <T>(projection: Record<keyof T, 1>) =>
  asRawPart<T, T>([{ $project: projection }])

export const $lookupRaw = <
  T extends JsonObj,
  U extends JsonObj,
  R,
  S,
  K1 extends string,
  K2 extends string,
>(
  { field2, field1 }: { field2: Field<U, S>; field1: Field<T, S> },
  { stages, coll }: RawStagesSource<R, U>,
  k1: K1,
  k2: K2,
) =>
  asRawPart<T, Record<K1, T> & Record<K2, U>>([
    {
      $replaceWith: { [k1]: '$ROOT' },
    },
    {
      $lookup: {
        from: coll.collectionName,
        as: k2,
        let: { local: `$${k1}.${field1.field}` },
        pipeline: [{ $match: { $expr: { $eq: ['$$local', `$${field2.field}`] } } }, ...stages],
      },
    },
    { $unwind: `$${k2}` },
  ])
