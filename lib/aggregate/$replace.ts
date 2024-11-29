import type { App, HKT, I, WriteonlyCollection } from '../../types'
import type { ID, O, RORec, doc } from '../../types/json'
import { $mergeObjects } from '../expression/array'
import { field } from '../expression/concat'
import { eqTyped, ite } from '../expression/logic'
import { nil, now } from '../expression/val'
import { root } from '../field'
import type { Del, OutInput, RawStages, TS } from '../types'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

interface AfterHKT<T> extends HKT {
  readonly out: OutInput<T> & RORec<'after', I<unknown, this>>
}

type ND = { readonly deletedAt: null }
export type Merge<T extends doc> = (T & ND & TS) | Del

export const $replace = <T extends doc>(
  out: WriteonlyCollection<Merge<T>>,
): RawStages<unknown, OutInput<T>, 'out'> => {
  const replacer = ite<Merge<T>, null, T, AfterHKT<T>>(
    eqTyped<null, T, AfterHKT<T>>(root<OutInput<T>>().of('after').expr(), nil),
    field<Del, OutInput<T, null>>({
      deletedAt: ['deletedAt', now],
      _id: ['_id', root<OutInput<T, null>>().of('_id').expr()],
      touchedAt: ['touchedAt', now],
    }),
    $mergeObjects<T, ND & TS, App<AfterHKT<T>, T>>(
      root<App<AfterHKT<T>, T>>().of('after').expr(),
      field({ deletedAt: ['deletedAt', nil], touchedAt: ['touchedAt', now] }),
    ),
  )
  return link<OutInput<T>>()
    .with<unknown, Merge<T>>($replaceWith_(replacer))
    .with<unknown, 'out'>(
      $merge_<Merge<T>, Merge<T>>({
        into: out,
        on: root<O<ID>>().of('_id'),
      }),
    ).stages
}
