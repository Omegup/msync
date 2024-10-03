import type { App, HKT, I, WriteonlyCollection } from '../../types'
import type { ID, N, O, RORec, Rec, U, doc, jsonItem } from '../../types/json'
import { $mergeObjects } from '../expression/array'
import { field } from '../expression/concat'
import { $ifNull, eqTyped, ite } from '../expression/logic'
import { nil, now, val } from '../expression/val'
import { root } from '../field'
import type { After, Del, Expr, OutInput, RawStages, TS } from '../types'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

interface AfterHKT<T> extends HKT {
  readonly out: OutInput<T> & RORec<'after', I<unknown, this>>
}

type ND = { readonly deletedAt: null }
export type Merge<T extends doc> = (T & ND & TS) | Del

export const $merge = <T extends doc>(
  out: WriteonlyCollection<Merge<T>>,
): RawStages<unknown, OutInput<T>, 'out'> => {
  const replacer = ite<Merge<T>, null, T, AfterHKT<T | null>>(
    eqTyped<null, T, AfterHKT<T | null>>(root<OutInput<T>>().of('after').expr(), nil),
    field<Del, OutInput<T>>({
      deletedAt: now,
      _id: $ifNull(root<OutInput<T>>().of('before').of<ID, '_id', U, 3>('_id').expr(), val('')),
      touchedAt: now,
    }),
    $mergeObjects<T, ND & TS, App<AfterHKT<T>, T>>(
      root<App<AfterHKT<T>, T>>().of('after').expr(),
      field({ deletedAt: nil, touchedAt: now }),
    ),
  )
  return link<OutInput<T>>()
    .with<unknown, Merge<T>>($replaceWith_(replacer))
    .with<unknown, 'out'>($merge_({ into: out, on: root<O<ID>>().of('_id') })).stages
}

type Par<K extends string, V extends Rec<K, jsonItem>> = { readonly [k in K]?: V[k] | N }
type ParMerge<K extends string, T extends Rec<K, jsonItem>> = TS & ID & O & Par<K, T>
type ExactKeys<K extends string> = { readonly [P in K]: P } & RORec<string, K>
const extractKeys = <K extends string>(keyObject: ExactKeys<K>): Set<K> =>
  new Set(Object.values(keyObject))

export const $partialMerge = <R extends doc, K extends string, T extends ID & Rec<K, jsonItem>>(
  out: WriteonlyCollection<Omit<R, K> & ParMerge<K, T>>,
  keyObject: ExactKeys<K>,
): RawStages<unknown, OutInput<T>, 'out'> => {
  const keys = [...extractKeys(keyObject)]
  const replacer = ite<ParMerge<K, T>, null, T, AfterHKT<T | null>>(
    eqTyped<null, T, AfterHKT<T | null>>(root<OutInput<T>>().of('after').expr(), nil),
    field<ParMerge<K, T>, After<Par<K, T>>, unknown>({
      _id: $ifNull(root<OutInput<R>>().of('before').of<ID, '_id', U, 3>('_id').expr(), val('')),
      touchedAt: now,
      ...Object.fromEntries<RORec<K, Expr<never, unknown>>, 0>(
        keys.map(k => [k, nil as Expr<never, unknown>]),
      ),
    }),
    field<ParMerge<K, T>, After<Par<K, T>>, unknown>({
      _id: root<App<AfterHKT<T>, T>>().of('after').of('_id').expr(),
      touchedAt: now,
      ...Object.fromEntries<RORec<K, Expr<never, unknown>>, 0>(
        keys.map(k => [
          k,
          root<App<AfterHKT<T>, T>>().of('after').of(k).expr() as Expr<never, unknown>,
        ]),
      ),
    }),
  )
  return link<OutInput<T>>()
    .with<unknown, ParMerge<K, T>>($replaceWith_(replacer))
    .with<unknown, 'out'>(
      $merge_<ParMerge<K, T>, Omit<R, K> & ParMerge<K, T>>({
        into: out,
        on: root<O<ID>>().of('_id'),
        whenNotMatched: 'fail',
      }),
    ).stages
}
