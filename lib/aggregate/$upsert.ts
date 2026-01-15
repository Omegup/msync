import type { Filter, HKT, I, IdHKT, RWCollection } from '../../types'
import type { ID, N, O, StrKey, doc } from '../../types/json'
import { mergeObjects } from '../expression/array'
import { field, mergeExpr, type ExprsExact, type ExprsExactHKT } from '../expression/concat'
import { eq, ite } from '../expression/logic'
import { current, nil } from '../expression/val'
import { root } from '../field'
import type { DDel, Del, Delta, Expr, RawStages, StreamRunnerParam, TS } from '../types'
import { translateOmit } from '../utils/guard'
import { id } from '../utils/json'
import { mapExactToObject, type MappedHKT } from '../utils/map-object'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

type ND = { readonly deletedAt?: null }

type SafeE<E> = Omit<E, `$${string}` | keyof ID>
export type Merge<T extends doc, E> = Omit<SafeE<E>, keyof (ND & TS)> & ((T & ND & TS) | Del)

export const $insertX = <T extends doc, D extends O, EEE>(
  out: RWCollection<Merge<T, EEE>>,
  expr: Expr<T, D>,
  map: (x: Expr<T & ND & TS & Omit<SafeE<EEE>, keyof (ND & TS)>, D>) => Expr<Merge<T, EEE>, D>,
  ext: ExprsExact<Omit<SafeE<EEE>, keyof (ND & TS)>, unknown>,
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
            mergeExpr<EE, ND & TS, D>(ext, {
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
            whenMatched: 'merge',
            whenNotMatched: 'insert',
          }),
        ).stages
    },
  }
}

export const $simpleInsert = <T extends doc>(
  out: RWCollection<Merge<T, {}>>,
): StreamRunnerParam<T, 'out'> => $insertX(out, root<T>().expr(), id, {})

export const $insertPart = <T extends doc, EEE>(
  out: RWCollection<Merge<T, EEE>>,
  ext: ExprsExact<Omit<SafeE<EEE>, keyof (ND & TS)>, unknown>,
): StreamRunnerParam<Delta<T>, 'out'> =>
  $insertX<T, Delta<T>, EEE>(
    out,
    assertNotNull(root<Delta<T>>().of('after').expr()),
    x =>
      ite<Merge<T, EEE>, Delta<T>>(
        eq(root<Delta<T>>().of('after').expr())(nil),
        field<DDel & Omit<SafeE<EEE>, keyof (ND & TS & ID)>, Delta<T>>(
          mergeExpr<SafeE<EEE>, DDel, Delta<T>>(
            translateOmit<EEE, `$${string}`, keyof ID, keyof (ND & TS)>().forward<
              ExprsExactHKT<unknown, unknown>
            >(ext),
            {
              deletedAt: ['deletedAt', current],
              _id: ['_id', assertNotNull(root<Delta<doc>>().of('before').of('_id').expr())],
              touchedAt: ['touchedAt', current],
            },
          ),
        ),
        x,
      ),
    ext,
  )

export const $insert = <T extends doc>(
  out: RWCollection<Merge<T, {}>>,
): StreamRunnerParam<Delta<T>, 'out'> => $insertPart(out, {})

const assertNotNull = <T, D, C>(expr: Expr<T | N, D, C>) => expr as Expr<T, D, C>
