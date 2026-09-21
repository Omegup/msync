import type { Filter, HKT, I, IdHKT, Replace, RWCollection } from '../../types'
import type { ID, N, O, RORec, StrKey, doc, rawItem } from '../../types/json'
import { mergeObjects } from '../expression/array'
import {
  field,
  mergeExpr,
  type ExprHKT,
  type ExprsExact,
  type ExprsExactHKT,
} from '../expression/concat'
import { eq, ite } from '../expression/logic'
import { current, nil, val } from '../expression/val'
import { root } from '../field'
import type { DDel, Del, Delta, Expr, RawStages, StreamRunnerParam, TS } from '../types'
import { translateOmit } from '../utils/guard'
import { id } from '../utils/json'
import { mapExact, mapExactToObject, type Exact, type MappedHKT } from '../utils/map-object'
import { getWhenMatchedForMerge } from './$merge'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

type ND = { readonly deletedAt?: null }

type SafeE<E> = Omit<E, `$${string}` | keyof ID>
export type Merge<T extends doc, E> = Omit<SafeE<E>, keyof (ND & TS)> & ((T & ND & TS) | Del)

type ExprP<P> = Expr<P, unknown, { new: P }>
type Update<P, Out> = (added: ExprP<P>, old: Expr<Out, Out>) => ExprP<P>

export const $insertX = <T extends doc, D extends O, EEE extends RORec<string, rawItem>>(
  out: RWCollection<Merge<T, EEE>>,
  expr: Expr<T, D>,
  map: (x: Expr<T & ND & TS & Omit<SafeE<EEE>, keyof (ND & TS)>, D>) => Expr<Merge<T, EEE>, D>,
  ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
  extExpr: ExprsExact<Omit<SafeE<EEE>, keyof (ND & TS)>, unknown>,
  update: Update<Replace<Merge<T, EEE>, {}>, Merge<T, EEE>> = x => x,
): StreamRunnerParam<D, 'out'> => {
  type EE = SafeE<EEE>
  type E = Omit<EE, keyof (ND & TS)>
  interface EqHKT<Dom = unknown> extends HKT<Dom> {
    readonly out: Record<'$eq', I<Dom, this>>
  }
  type Out = Merge<T, EEE>
  const filter: {
    readonly [K in StrKey<E>]: Record<'$eq', E[K]>
  } = mapExactToObject<E, IdHKT, MappedHKT<E, EqHKT>>(ext, v => ({ $eq: v }))

  return {
    teardown: c =>
      c<Out, 'updateMany'>({
        collection: out,
        method: 'updateMany',
        params: [
          filter as Filter<Out>,
          [{ $set: { deletedAt: '$$NOW', touchedAt: '$$CLUSTER_TIME' } }],
        ],
      }),
    raw: (): RawStages<unknown, D, 'out'> => {
      const replacer = map(
        mergeObjects<T, ND & TS & E, D>(
          expr,
          field(
            mergeExpr<EE, ND & TS, D>(extExpr, {
              deletedAt: ['deletedAt', nil],
              touchedAt: ['touchedAt', current],
            }),
          ),
        ),
      )

      return link<D>()
        .with<unknown, Out>($replaceWith_(replacer))
        .with<unknown, 'out'>(
          $merge_<Out, Out>({
            into: out,
            on: root<O<ID>>().of('_id'),
            stages: true,
            whenMatched: getWhenMatchedForMerge<Out, Out, never>('insert', update),
            whenNotMatched: 'insert',
          }),
        ).stages
    },
  }
}

export const $simpleInsert = <T extends doc>(
  out: RWCollection<Merge<T, {}>>,
): StreamRunnerParam<T, 'out'> => $insertX(out, root<T>().expr(), id, {}, {})

export const $insertPart = <T extends doc, EEE extends RORec<string, rawItem>>(
  out: RWCollection<Merge<T, EEE>>,
  ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
): StreamRunnerParam<Delta<T>, 'out'> => {
  type EE = SafeE<EEE>
  type E = Omit<EE, keyof (ND & TS)>
  const extExpr = mapExact<E, IdHKT, ExprHKT<unknown>>(
    ext,
    <P extends StrKey<E>>(v: E[P]): Expr<E[P], unknown> => val<E[P]>(v),
  )
  return $insertX<T, Delta<T>, EEE>(
    out,
    assertNotNull<T, Delta<T>>(root<Delta<T>>().of('after').expr()),
    x =>
      ite<Merge<T, EEE>, Delta<T>>(
        eq<T | null, Delta<T>>(root<Delta<T>>().of('after').expr())(nil),
        field<DDel & Omit<SafeE<EEE>, keyof (ND & TS & ID)>, Delta<T>>(
          mergeExpr<SafeE<EEE>, DDel, Delta<T>>(
            translateOmit<EEE, `$${string}`, keyof ID, keyof (ND & TS)>().forward<
              ExprsExactHKT<unknown, unknown>
            >(extExpr),
            {
              deletedAt: ['deletedAt', current],
              _id: [
                '_id',
                assertNotNull(root<Delta<T>>().of('before').of<T, '_id', null>('_id').expr()),
              ],
              touchedAt: ['touchedAt', current],
            },
          ),
        ),
        x,
      ),
    ext,
    extExpr,
  )
}

export const $insert = <T extends doc>(
  out: RWCollection<Merge<T, {}>>,
): StreamRunnerParam<Delta<T>, 'out'> => $insertPart(out, {})

const assertNotNull = <T, D, C = unknown>(expr: Expr<T | N, D, C>) => expr as Expr<T, D, C>
