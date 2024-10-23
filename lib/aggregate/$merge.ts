import type { ConstHKT, HKT, I, WriteonlyCollection } from '../../types'
import type { ID, O, Par, RORec, Rec, U, doc, jsonItem } from '../../types/json'
import { field, mergeExpr, type ExprHKT, type ExprsExact } from '../expression/concat'
import { $ifNull, eqTyped, ite } from '../expression/logic'
import { nil, now, val } from '../expression/val'
import { root } from '../field'
import type { OutInput, RawStages, TS } from '../types'
import { omitPar } from '../utils/guard'
import { asExact, mapExact, type ExactKeys } from '../utils/map-object'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'
interface AfterHKT<T> extends HKT {
  readonly out: OutInput<T> & RORec<'after', I<unknown, this>>
}
type Allowed<K extends string> = Exclude<K, keyof (TS & ID)>
type ParMerge<K extends string, T extends Rec<K, jsonItem>> = TS & ID & O & Par<K, T>

export const $merge = <R extends doc, KK extends string, T extends ID & Rec<Allowed<KK>, jsonItem>>(
  out: WriteonlyCollection<Omit<R, Allowed<KK>> & ParMerge<Allowed<KK>, T>>,
  keyObject: ExactKeys<Allowed<KK>>,
): RawStages<unknown, OutInput<T>, 'out'> => {
  type K = Allowed<KK>
  const keys = asExact(keyObject)
  interface FromOut<E, N> extends HKT {
    readonly out: ExprsExact<E & I<unknown, this>, OutInput<T, N>>
  }
  const omit = <N, E = TS & ID & O>() => omitPar<KK, never, keyof (TS & ID), T, FromOut<E, N>>()
  const replacer = ite<ParMerge<K, T>, null, T, AfterHKT<T>>(
    eqTyped<null, T, AfterHKT<T>>(root<OutInput<T>>().of('after').expr(), nil),
    field<ParMerge<K, T>, OutInput<T, null>>(
      omit<null>().backward(
        mergeExpr<Par<K, T>, TS & ID, OutInput<T, null>, unknown, O>(
          omit<null, unknown>().forward(
            mapExact<Par<K, T>, ConstHKT<1>, ExprHKT<OutInput<T, null>>>(keys, () => nil),
          ),
          {
            _id: [
              '_id',
              $ifNull(root<OutInput<T>>().of('before').of<ID, '_id', U, 3>('_id').expr(), val('')),
            ],
            touchedAt: ['touchedAt', now],
          },
        ),
      ),
    ),
    field<ParMerge<K, T>, OutInput<T, T>>(
      omit<T>().backward(
        mergeExpr<Par<K, T>, TS & ID, OutInput<T, T>, unknown, O>(
          omit<T, unknown>().forward(
            mapExact<Par<K, T>, ConstHKT<1>, ExprHKT<OutInput<T, T>>>(keys, (_, k) =>
              root<OutInput<T, T>>().of('after').of(k).expr(),
            ),
          ),
          {
            _id: ['_id', root<OutInput<T, T>>().of('after').of('_id').expr()],
            touchedAt: ['touchedAt', now],
          },
        ),
      ),
    ),
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
