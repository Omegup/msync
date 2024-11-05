import type { ConstHKT, HKT, I, WriteonlyCollection } from '../../types'
import type { ID, N, O, Par, RORec, Rec, StrKey, U } from '../../types/json'
import { field, mergeExpr, type ExprHKT, type ExprsExactHKT } from '../expression/concat'
import { $ifNull, eqTyped, ite } from '../expression/logic'
import { nil, now, val } from '../expression/val'
import { root } from '../field'
import type { Expr, Model, OutInput, RawStages, TS } from '../types'
import { omitPar } from '../utils/guard'
import { mapExact, type ExactKeys } from '../utils/map-object'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'
interface AfterHKT<T> extends HKT {
  readonly out: OutInput<T> & RORec<'after', I<unknown, this>>
}
type Allowed<K extends string> = Exclude<K, keyof (TS & ID)>
type ParMerge<K extends string, T extends Rec<K>> = TS & ID & O & Par<K, T>

export const $merge =
  <V extends Model & ID>() =>
  <MKeys extends StrKey<V>>(
    out: WriteonlyCollection<Omit<V, MKeys> & (Pick<V, MKeys> | Rec<MKeys, N>)>,
    keys: ExactKeys<MKeys>,
  ): RawStages<unknown, OutInput<Pick<V, MKeys>>, 'out'> => {
    type KK = any
    type T = any
    type R = any
    type K = Allowed<KK>
    type FromOut<N, E = TS & ID & O> = ExprsExactHKT<E, OutInput<T, N>>
    const omit = omitPar<KK, never, keyof (TS & ID), T>()
    const replacer = ite<ParMerge<K, T>, null, T, AfterHKT<T>>(
      eqTyped<null, T, AfterHKT<T>>(root<OutInput<T>>().of('after').expr(), nil),
      field<ParMerge<K, T>, OutInput<T, null>>(
        omit.backward<FromOut<null>>(
          mergeExpr<Par<K, T>, TS & ID, OutInput<T, null>, unknown, O>(
            omit.forward<FromOut<null, unknown>>(
              mapExact<Par<K, T>, ConstHKT<1>, ExprHKT<OutInput<T, null>>>(keys, () => nil),
            ),
            {
              _id: [
                '_id',
                $ifNull(
                  root<OutInput<T>>().of('before').of<ID, '_id', U, 3>('_id').expr() as any,
                  val(''),
                ),
              ],
              touchedAt: ['touchedAt', now],
            },
          ),
        ),
      ),
      field<ParMerge<K, T>, OutInput<T, T>>(
        omit.backward<FromOut<T>>(
          mergeExpr<Par<K, T>, TS & ID, OutInput<T, T>, unknown, O>(
            omit.forward<FromOut<T, unknown>>(
              mapExact<Par<K, T>, ConstHKT<1>, ExprHKT<OutInput<T, T>>>(
                keys,
                <P extends keyof T & StrKey<Par<Exclude<KK, '_id' | 'touchedAt'>, T>>>(
                  _: 1,
                  k: P,
                ): Expr<T[P], OutInput<T, T>> => {
                  const p = k
                  return root<OutInput<T, T>>().of('after').of(p).expr()
                },
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
          into: out as any,
          on: root<O<ID>>().of('_id'),
          whenNotMatched: 'fail',
        }),
      ).stages
  }
