import type { Timestamp } from 'mongodb'
import {
  type App,
  type HKT,
  type I,
  type ID,
  type O,
  type RORec,
  type U,
  type WriteonlyCollection,
  type doc,
} from '../../types'
import { $mergeObjects } from '../expression/array'
import { field } from '../expression/concat'
import { $ifNull, eqTyped, ite } from '../expression/logic'
import { nil, now, val } from '../expression/val'
import { root } from '../field'
import type { Delta, RawStages } from '../types'
import { $merge_, $replaceWith_ } from './mongo-stages'
import { link } from './prefix'

interface AfterHKT<T> extends HKT {
  readonly out: Delta<T> & RORec<'after', I<unknown, this>>
}

type D = { readonly deletedAt: null }
type Del = O<{ readonly deletedAt: Timestamp; readonly _id: string } & TS>
type TS = { readonly touchedAt: Timestamp }
export type Merge<T extends doc> = (T & D & TS) | Del

export const $mergeDelta = <T extends doc>(
  out: WriteonlyCollection<Merge<T>>,
): RawStages<Delta<T>, never> => {
  const replacer = ite<Merge<T>, null, T, AfterHKT<T | null>>(
    eqTyped<null, T, AfterHKT<T | null>>(root<Delta<T>>().of('after').expr(), nil),
    field<Del, Delta<T>>({
      deletedAt: now,
      _id: $ifNull(root<Delta<T>>().of('before').of<T, '_id', U, 3>('_id').expr(), val('')),
      touchedAt: now,
    }),
    $mergeObjects<T, D & TS, App<AfterHKT<T>, T>>(
      root<App<AfterHKT<T>, T>>().of('after').expr(),
      field({ deletedAt: nil, touchedAt: now }),
    ),
  )
  return link<Delta<T>>()
    .with<Merge<T>>($replaceWith_(replacer))
    .with<never>($merge_({ into: out, on: root<O<ID>>().of('_id') })).stages
}
