import type { ConstHKT, Filter, HKT, I, IdHKT, OPick, RWCollection } from '../../types'
import type { ID, N, O, RORec, Rec, Replace, StrKey, doc, rawItem } from '../../types/json'
import { field, type ExprHKT, type ExprsExact, type ExprsExactHKT } from '../expression/concat'
import { eqTyped, ite, sub } from '../expression/logic'
import { current, nil } from '../expression/val'
import { Field, root } from '../field'
import type { Before, Delta, Expr, RawStages, StreamRunnerParam, TS } from '../types'
import { omitPick, omitRORec, type Equal } from '../utils/guard'
import { id } from '../utils/json'
import { mapExact, mapExactToObject, spread, type Exact, type MappedHKT } from '../utils/map-object'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { asStages, link } from './prefix'

type OutInputE<T, E, A = T | null> = ID & Rec<'after', A> & E
type Allowed<K extends string> = Exclude<K, keyof (TS & ID)>

type Patch<V, KK extends StrKey<V> = StrKey<V>> = (
  | (OPick<V, Allowed<KK>> & ID)
  | (Rec<Allowed<KK>, N> & ID)
) &
  TS
type TakeDoc<V, E = ID, KK extends StrKey<V> = StrKey<V>> = OPick<V, Allowed<KK>> & E
type ND = { readonly deletedAt?: null }

type SafeE<E> = Omit<E, `$${string}` | keyof ID>

const $mergeX = <
  V extends O,
  Out extends doc,
  Source extends O,
  SourcePart extends doc,
  EEE extends RORec<string, rawItem>,
  Intermediate extends O = Source,
>(
  out: RWCollection<Out | Replace<Out, Patch<V>>, Out>,
  keys: ExprsExact<TakeDoc<V, unknown>, SourcePart>,
  f: Field<Intermediate, SourcePart>,
  map: (x: Expr<Patch<V>, Intermediate>) => Expr<Patch<V>, Source>,
  whenNotMatched: 'fail' | 'discard' = 'fail',
  ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
): StreamRunnerParam<Source, 'out'> => {
  type EE = SafeE<EEE>
  type E = Omit<EE, keyof (ND & TS)>
  type KK = StrKey<V>
  type K = Allowed<StrKey<V>>
  type T = OPick<V, K> & ID
  type P = (T | (Rec<K, N> & ID)) & TS
  const patch: ExprsExact<OPick<V, K>, Intermediate> = mapExact<
    OPick<V, K>,
    ExprHKT<SourcePart>,
    ExprHKT<Intermediate>
  >(keys, v => sub(v, f))
  interface EqHKT<Dom = unknown> extends HKT<Dom> {
    readonly out: Record<'$eq', I<Dom, this>>
  }
  const filter: {
    readonly [K in StrKey<E>]: Record<'$eq', E[K]>
  } = mapExactToObject<E, IdHKT, MappedHKT<E, EqHKT>>(ext, v => ({ $eq: v }))

  const setDeleted = whenNotMatched === 'discard'

  const replacer: Expr<P, Source> = map(
    field<T & TS, Intermediate>(
      omitPick<KK, never, keyof (TS & ID), V>().backward<ExprsExactHKT<TS & doc, Intermediate>>(
        spread<Pick<V, K>, ID & TS, ExprHKT<Intermediate>, O>(patch, {
          _id: ['_id', f.of('_id').expr()],
          touchedAt: ['touchedAt', current],
          deletedAt: [setDeleted ? ('deletedAt' as never) : 'touchedAt', current],
        }),
      ),
    ),
  )
  return {
    raw: (first: boolean): RawStages<unknown, Source, 'out'> =>
      link<Source>()
        .with<unknown, P>($replaceWith_<Source, P>(replacer))
        .with<unknown, 'out'>(
          $merge_<P, Out>({
            into: out,
            on: root<O<ID>>().of('_id'),
            whenNotMatched: whenNotMatched === 'fail' ? 'fail' : ('insert' as 'discard'),
            stages: true,
            whenMatched: asStages<O, Out, Out, { new: Out }>([
              {
                $replaceWith: {
                  old: '$$ROOT',
                  merged: {
                    $mergeObjects: [
                      '$$ROOT',
                      '$$new',
                      ...(setDeleted ? [{ deletedAt: { $ifNull: ['$deletedAt', null] } }] : []),
                    ],
                  },
                },
              },
              {
                $replaceWith: {
                  $cond: {
                    if: {
                      $eq: [
                        { $mergeObjects: ['$old', { deletedAt: { $ifNull: ['$old.deletedAt', null] } }] },
                        { $mergeObjects: ['$merged', { touchedAt: '$old.touchedAt' }] },
                      ],
                    },
                    then: '$old',
                    else: '$merged',
                  },
                },
              },
            ]),
          }),
        ).stages,
    teardown: c =>
      c({
        collection: out,
        method: 'updateMany',
        params: [
          filter as Filter<Out | Replace<Out, Patch<V, StrKey<V>>>>,
          [
            {
              $unset: Object.keys(
                mapExactToObject<TakeDoc<V, unknown>, IdHKT, ConstHKT<1>>(keys, () => 1),
              ),
            },
          ],
        ],
      }),
  }
}

const $mergeId =
  <V extends O>() =>
  <SourcePart extends doc, Out extends doc, E = unknown, EEE extends RORec<string, rawItem> = {}>(
    out: RWCollection<Out | Replace<Out, Patch<V>>, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, SourcePart>,
    id: Expr<string, OutInputE<TakeDoc<V>, E, null>>,
    ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
    whenNotMatched: 'fail' | 'discard',
  ): StreamRunnerParam<OutInputE<SourcePart, E>, 'out'> => {
    type OutInput<T, A = T | null> = OutInputE<T, E, A>
    interface AfterHKT<T> extends HKT {
      readonly out: OutInput<T> & RORec<'after', I<unknown, this>>
    }
    type KK = StrKey<V>
    type K = Allowed<KK>
    type T = TakeDoc<V>
    type Patch = (T | (Rec<K, N> & ID)) & TS

    type Source = OutInputE<SourcePart, E>
    type Intermediate = OutInputE<0, E, SourcePart>

    const omRORec: Equal<unknown, RORec<K, N>, Omit<RORec<K, N>, keyof (TS & ID)>> = omitRORec<
      KK,
      never,
      keyof (TS & ID),
      N
    >()

    // Expr<Patch, ID & Obj & RORec<"after", T | null> & E & RORec<"after", Obj & Pick<V, Exclude<KK, "touchedAt" | "_id">> & ID>, unknown>

    return $mergeX<V, Out, Source, SourcePart, EEE, Intermediate>(
      out,
      keys,
      root<Intermediate>().of('after'),
      or => {
        return ite<Patch, null, SourcePart, AfterHKT<SourcePart>>(
          eqTyped<null, SourcePart, AfterHKT<SourcePart>>(
            root<OutInput<SourcePart>>().of('after').expr(),
            nil,
          ),
          field<RORec<K, N> & ID & TS, OutInput<T, null>>(
            omRORec.backward<ExprsExactHKT<ID & TS, OutInput<T, null>>>(
              spread<RORec<K, N>, ID & TS, ExprHKT<OutInput<T, null>>>(
                mapExact<OPick<V, Allowed<KK>>, IdHKT, ConstHKT<Expr<null, unknown>>>(
                  keys,
                  () => nil,
                ),
                {
                  _id: ['_id', id],
                  touchedAt: ['touchedAt', current],
                },
              ),
            ),
          ),
          or,
        )
      },
      whenNotMatched,
      ext,
    )
  }

export const $simpleMergePart =
  <V extends O>() =>
  <Source extends doc, Out extends doc, EEE extends RORec<string, rawItem>>(
    out: RWCollection<Out | Replace<Out, Patch<V>>, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, Source>,
    whenNotMatched: 'fail' | 'discard',
    ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
  ): StreamRunnerParam<Source, 'out'> =>
    $mergeX<V, Out, Source, Source, EEE>(out, keys, root(), id, whenNotMatched, ext)

export const $simpleMerge =
  <V extends O>() =>
  <Source extends doc, Out extends doc>(
    out: RWCollection<Out | Replace<Out, Patch<V>>, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, Source>,
    whenNotMatched: 'fail' | 'discard' = 'fail',
  ): StreamRunnerParam<Source, 'out'> =>
    $mergeX<V, Out, Source, Source, {}>(out, keys, root(), id, whenNotMatched, {})

export const $merge =
  <V extends O>() =>
  <Out extends doc, SourcePart extends doc>(
    out: RWCollection<Out | Replace<Out, Patch<V>>, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, SourcePart>,
    whenNotMatched: 'fail' | 'discard' = 'fail',
  ): StreamRunnerParam<Delta<SourcePart>, 'out'> =>
    $mergeId<V>()<SourcePart, Out, Before<SourcePart | null>>(
      out,
      keys,
      assertNotNull(root<Rec<'before', (doc & SourcePart) | null>>().of('before').of('_id').expr()),
      {},
      whenNotMatched,
    )

const assertNotNull = <T, D, C>(expr: Expr<T | N, D, C>) => expr as Expr<T, D, C>
