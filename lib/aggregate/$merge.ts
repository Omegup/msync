import type { App, ConstHKT, HKT, I, IdHKT, OPick, WriteonlyCollection } from '../../types'
import type { ID, N, O, RORec, Rec, StrKey, U } from '../../types/json'
import {
  field,
  type ExprHKT,
  type ExprsExact,
  type ExprsExactHKT
} from '../expression/concat'
import { $ifNull, eqTyped, ite } from '../expression/logic'
import { nil, now, val } from '../expression/val'
import { root } from '../field'
import type { Expr, Model, OutInput, RawStages, TS } from '../types'
import { omitPick, omitRORec, type Equal } from '../utils/guard'
import {
  mapExact,
  mapExactToObject,
  spread,
  type ExactKeys,
  type WithKey1
} from '../utils/map-object'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'
interface AfterHKT<T> extends HKT {
  readonly out: OutInput<T> & RORec<'after', I<unknown, this>>
}
type Allowed<K extends string> = Exclude<K, keyof (TS & ID)>
type Outt<V, MKeys extends StrKey<V>> = ID & TS & Omit<V, MKeys> & (OPick<V, MKeys> | Rec<MKeys, N>)

export const $merge =
  <V extends Model & ID>() =>
  <KK extends StrKey<V>>(
    out: WriteonlyCollection<Outt<V, Allowed<KK>>>,
    keys: ExactKeys<Allowed<KK>>,
  ): RawStages<unknown, OutInput<OPick<V, Allowed<KK>> & ID>, 'out'> => {
    type K = Allowed<KK>
    type T = OPick<V, K> & ID
    type Patch = (T | (Rec<K, N> & ID)) & TS
    type Out = Outt<V, K>
    type FromOut<N, E = TS & ID & O> = ExprsExactHKT<E, OutInput<T, N>>

    const omRORec: Equal<unknown, RORec<K, N>, Omit<RORec<K, N>, keyof (TS & ID)>> = omitRORec<
      KK,
      never,
      keyof (TS & ID),
      N
    >()

    interface ExprHKT2<T, D, C = unknown, F extends HKT = IdHKT> extends HKT<StrKey<T>> {
      readonly out: Expr<App<F, T[I<StrKey<T>, this>]>, D, C>
    }
    type F = WithKey1<K, ExprHKT2<T, OutInput<T, T>>>

    const patch: ExprsExact<OPick<V, K>, OutInput<T, T>> = mapExactToObject<RORec<K, 1>, IdHKT, F>(
      keys,
      (_, k) => [k, root<OutInput<T, T>>().of('after').of<T, typeof k, 1>(k).expr()],
    )
    const replacer = ite<Patch, null, T, AfterHKT<T>>(
      eqTyped<null, T, AfterHKT<T>>(root<OutInput<T>>().of('after').expr(), nil),
      field<RORec<K, N> & ID & TS, OutInput<T, null>>(
        omRORec.backward<FromOut<null, ID & TS>>(
          spread<RORec<K, N>, ID & TS, ExprHKT<OutInput<T, null>>>(
            mapExact<RORec<K, 1>, IdHKT, ConstHKT<Expr<null, unknown>>>(keys, () => nil),
            {
              _id: [
                '_id',
                $ifNull(
                  root<OutInput<T>>().of('before').of<ID, '_id', U, 3>('_id').expr(),
                  val(''),
                ),
              ],
              touchedAt: ['touchedAt', now],
            },
          ),
        ),
      ),
      field<OPick<V, K> & ID & TS, OutInput<T, T>>(
        omitPick<KK, never, keyof (TS & ID), V>().backward<FromOut<T>>(
          spread<Pick<V, K>, ID & TS, ExprHKT<OutInput<T, T>>, O>(patch, {
            _id: ['_id', root<OutInput<T, T>>().of('after').of('_id').expr()],
            touchedAt: ['touchedAt', now],
          }),
        ),
      ),
    )
    return link<OutInput<T>>()
      .with<unknown, Patch>($replaceWith_(replacer))
      .with<unknown, 'out'>(
        $merge_<Patch, Out>({
          into: out,
          on: root<O<ID>>().of('_id'),
          whenNotMatched: 'fail',
        }),
      ).stages
  }
