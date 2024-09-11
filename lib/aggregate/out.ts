import type { WriteonlyCollection, jsonItem } from '../../types'
import type { Field } from '../field'
import { dbcoll } from '../utils/coll'
import { asStages } from './prefix'

export const $merge_ = <T>({
  into,
  on,
}: {
  into: WriteonlyCollection<T>
  on: Field<T, jsonItem>
}) => asStages<T, never>([{ $merge: { into: dbcoll(into), on: on.str() } }])
