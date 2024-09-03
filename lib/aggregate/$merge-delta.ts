import type { Timestamp } from 'mongodb'
import type { App, HKT, I, JsonObj, O, RORec, WriteonlyCollection } from '../../types'
import { $mergeObjects } from '../expression/array'
import { field } from '../expression/concat'
import { eqTyped, ite } from '../expression/logic'
import { nil, now } from '../expression/val'
import { root } from '../field'
import type { Delta, RawStages } from '../types'
import { $merge_, $replaceWith_ } from './mongo-stages'
import { link } from './prefix'

interface AfterHKT<T> extends HKT {
  readonly out: Delta<T> & RORec<'after', I<unknown, this>>
}

type Del = O<{ deletedAt: Timestamp }>

export const $mergeDelta = <T extends JsonObj>(
  out: WriteonlyCollection<(T & { deletedAt: null }) | Del>,
): RawStages<Delta<T>, never> =>
  link<Delta<T>>()
    .with<(T & { deletedAt: null }) | Del>(
      $replaceWith_(
        ite<(T & { deletedAt: null }) | Del, null, T, AfterHKT<T>>(
          eqTyped<null, T, AfterHKT<T>>(root<Delta<T>>().of('after'), nil),
          field({ deletedAt: now }),
          $mergeObjects<T, { deletedAt: null }, App<AfterHKT<T>, T>>(
            root<App<AfterHKT<T>, T>>().of('after'),
            field({ deletedAt: nil }),
          ),
        ),
      ),
    )
    .with<never>($merge_({ into: out })).stages

