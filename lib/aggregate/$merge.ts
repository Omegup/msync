import type {
  ConstHKT,
  Filter,
  HKT,
  I,
  IdHKT,
  OPick,
  RWCollection,
  Timestamp,
  WriteonlyCollection,
} from '../../types'
import type { doc, ID, N, O, rawItem, Rec, Replace, RORec, StrKey } from '../../types/json'
import { mergeObjects } from '../expression'
import { field, type ExprHKT, type ExprsExact, type ExprsExactHKT } from '../expression/concat'
import { $ifNull, eq, eqTyped, ite, sub } from '../expression/logic'
import { afterWriteTime, current, nil } from '../expression/val'
import { ctx, Field, root } from '../field'
import type {
  Before,
  DeletedAt,
  Delta,
  Expr,
  IsDeleted,
  Model,
  RawStages,
  StreamRunnerParam,
  TeardownRecord,
  TS,
} from '../types'
import { set, to } from '../update'
import { omitPick, omitRORec, type Equal } from '../utils/guard'
import { id } from '../utils/json'
import { mapExact, mapExactToObject, spread, type Exact, type MappedHKT } from '../utils/map-object'
import { $replaceWith_, $set_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

type OutInputE<T, E, A = T | null> = ID & Rec<'after', A> & E
type Allowed<K extends string> = Exclude<K, keyof (TS & ID)>

export type Patch<V, KK extends StrKey<V> = StrKey<V>> = (
  | (OPick<V, Allowed<KK>> & ID)
  | (Rec<Allowed<KK>, N> & ID)
) &
  TS
type TakeDoc<V, E = ID, KK extends StrKey<V> = StrKey<V>> = OPick<V, Allowed<KK>> & E
type ND = { readonly deletedAt?: null }

type SafeE<E> = Omit<E, `$${string}` | keyof ID>
export const getWhenMatchedForMerge = <
  Out extends Model,
  P extends Model,
  K extends keyof IsDeleted,
>(
  whenNotMatched: 'discard' | 'fail' | 'insert',
): RawStages<O, Out, Out | Replace<Out, P>, RORec<'new', Replace<P, RORec<K, Timestamp>>>> => {
  const orNull = <T, C>(e: Expr<Timestamp | N, T, C>) =>
    whenNotMatched === 'discard' ? $ifNull(e, nil) : e
  type PP = Replace<P, RORec<K, Timestamp>>

  type Merged = Replace<Out, P>
  type OldAndMerged = Rec<'old' | 'merged', Out | Merged>

  const newOrOld: Field<O<DeletedAt>, O<DeletedAt>, RORec<'new', O<DeletedAt>>> = whenNotMatched ===
  'insert'
    ? ctx<O<DeletedAt>>()('new')
    : root<O<DeletedAt>>()
  const merged = mergeObjects<Out | Merged, O<DeletedAt>, Out, { new: PP }>(
    root<Out>().expr(),
    ctx<PP>()('new').expr(),
    field<O<DeletedAt>, Out, { new: PP }>({
      deletedAt: ['deletedAt', orNull(newOrOld.of('deletedAt').expr())],
    }),
  ) as Expr<Replace<Out, P>, Out, { new: PP }>
  return link<Out, { new: PP }>()
    .with(
      $replaceWith_<Out, OldAndMerged, { new: PP }>(
        field<OldAndMerged, Out, { new: PP }>({
          old: ['old', root<Out>().expr()],
          merged: ['merged', merged],
        }),
      ),
    )
    .with(getWhenMatched(whenNotMatched)).stages
}
export const getWhenMatched = <Out extends Model, P extends Model, K extends keyof IsDeleted>(
  whenNotMatched: 'discard' | 'fail' | 'insert',
): RawStages<O, Rec<'old' | 'merged', Out | Replace<Out, P>>, Out | Replace<Out, P>> => {
  const orNull = <T, C>(e: Expr<Timestamp | N, T, C>) =>
    whenNotMatched === 'discard' ? $ifNull(e, nil) : e

  type Merged = Replace<Out, P>
  type OldAndMerged = Rec<'old' | 'merged', Out | Merged>
  const preMergeOld: Expr<Out | Merged, OldAndMerged> = mergeObjects<
    Out | Merged,
    O<DeletedAt>,
    OldAndMerged
  >(
    root<OldAndMerged>().of('old').expr(),
    field<O<DeletedAt> & TS, OldAndMerged>({
      deletedAt: ['deletedAt', orNull(root<OldAndMerged>().of('old').of('deletedAt').expr())],
      touchedAt: ['touchedAt', root<OldAndMerged>().of('merged').of('touchedAt').expr()],
    }),
  )

  const same = eq<Out | Merged, OldAndMerged>(preMergeOld)(root<OldAndMerged>().of('merged').expr())

  return link<OldAndMerged>().with(
    $replaceWith_<OldAndMerged, Out | Replace<Out, P>>(
      ite(same, root<OldAndMerged>().of('old').expr(), root<OldAndMerged>().of('merged').expr()),
    ),
  ).stages
}

type MergeCollection<V extends O, Out extends Model> =
  | {
      coll: RWCollection<Out | Replace<Out, Patch<V>> | Replace<Patch<V>, IsDeleted>, Out>
      whenNotMatched: 'discard'
    }
  | {
      coll: RWCollection<Out | Replace<Out, Patch<V>>, Out>
      whenNotMatched: 'fail'
    }

const $mergeX = <
  V extends O,
  Out extends Model,
  Source extends O,
  SourcePart extends doc,
  EEE extends RORec<string, rawItem>,
  Intermediate extends O = Source,
>(
  out: MergeCollection<V, Out>,
  keys: ExprsExact<TakeDoc<V, unknown>, SourcePart>,
  f: Field<Intermediate, SourcePart>,
  map: (x: Expr<Patch<V>, Intermediate>) => Expr<Patch<V>, Source>,
  ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
): StreamRunnerParam<Source, 'out'> => {
  type EE = SafeE<EEE>
  type E = Omit<EE, keyof (ND & TS)>
  type KK = StrKey<V>
  type K = Allowed<StrKey<V>>
  type T = OPick<V, K> & ID
  type P = (T | (Rec<K, N> & ID)) & TS
  type In1 = Out | Replace<Out, P> | Replace<P, IsDeleted>
  type In2 = Out | Replace<Out, P>
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

  const setDeleted = out.whenNotMatched === 'discard'

  const replacer: Expr<Patch<V>, Source> = map(
    field<T & TS, Intermediate>(
      omitPick<KK, never, keyof (TS & ID), V>().backward<ExprsExactHKT<TS & doc, Intermediate>>(
        spread<Pick<V, K>, ID & TS, ExprHKT<Intermediate>, O>(patch, {
          _id: ['_id', f.of('_id').expr()],
          touchedAt: ['touchedAt', afterWriteTime],
        }),
      ),
    ),
  )

  const sss: RawStages<unknown, P, 'out'> = setDeleted
    ? link<P>()
        .with<O, Replace<P, IsDeleted>>(
          $set_<O, P, Replace<P, IsDeleted>>(
            set<IsDeleted>()({
              deletedAt: ['deletedAt', to<P, Timestamp>(current)],
            }),
          ),
        )
        .with(
          $merge_<Replace<P, IsDeleted>, Out, unknown, In1>({
            into: out.coll,
            on: root<doc>().of('_id'),
            whenNotMatched: 'insert',
            stages: true,
            whenMatched: getWhenMatchedForMerge<Out, P, keyof IsDeleted>(out.whenNotMatched),
          }),
        ).stages
    : link<P>().with(
        $merge_<P, Out, unknown, In2>({
          into: out.coll,
          on: root<doc>().of('_id'),
          whenNotMatched: 'fail',
          stages: true,
          whenMatched: getWhenMatchedForMerge<Out, P, never>(out.whenNotMatched),
        }),
      ).stages

  const teardown = <W>(coll: WriteonlyCollection<W>): TeardownRecord<W, 'updateMany'> => ({
    collection: coll,
    method: 'updateMany',
    params: [
      filter as Filter<W>,
      [
        {
          $unset: Object.keys(
            mapExactToObject<TakeDoc<V, unknown>, IdHKT, ConstHKT<1>>(keys, () => 1),
          ),
        },
      ],
    ],
  })
  return {
    raw: (first: boolean): RawStages<unknown, Source, 'out'> =>
      link<Source>().with<unknown, P>($replaceWith_<Source, P>(replacer)).with<unknown, 'out'>(sss)
        .stages,
    // blame typescript for this, not me ¯\_(ツ)_/¯
    teardown: c => (setDeleted ? c(teardown(out.coll)) : c(teardown(out.coll))),
  }
}

export const $mergeId =
  <V extends O>() =>
  <SourcePart extends doc, Out extends Model, E = unknown, EEE extends RORec<string, rawItem> = {}>(
    out: MergeCollection<V, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, SourcePart>,
    id: Expr<string, OutInputE<TakeDoc<V>, E, null>>,
    ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
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
                  touchedAt: ['touchedAt', afterWriteTime],
                },
              ),
            ),
          ),
          or,
        )
      },
      ext,
    )
  }

export const $simpleMergePart =
  <V extends O>() =>
  <Source extends doc, Out extends Model, EEE extends RORec<string, rawItem>>(
    out: MergeCollection<V, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, Source>,
    ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
  ): StreamRunnerParam<Source, 'out'> =>
    $mergeX<V, Out, Source, Source, EEE>(out, keys, root(), id, ext)

export const $simpleMerge =
  <V extends O>() =>
  <Source extends doc, Out extends Model>(
    out: RWCollection<Out | Replace<Out, Patch<V>> | Replace<Patch<V>, IsDeleted>, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, Source>,
    whenNotMatched: 'fail' | 'discard' = 'fail',
  ): StreamRunnerParam<Source, 'out'> =>
    $mergeX<V, Out, Source, Source, {}>({ coll: out, whenNotMatched }, keys, root(), id, {})

export const $mergePart =
  <V extends O>() =>
  <Out extends Model, SourcePart extends doc, EEE extends RORec<string, rawItem>>(
    out: RWCollection<Out | Replace<Out, Patch<V>>, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, SourcePart>,
    ext: Exact<Omit<SafeE<EEE>, keyof (ND & TS)>, IdHKT>,
  ): StreamRunnerParam<Delta<SourcePart>, 'out'> =>
    $mergeId<V>()<SourcePart, Out, Before<SourcePart | null>, EEE>(
      { coll: out, whenNotMatched: 'fail' },
      keys,
      assertNotNull(root<Rec<'before', (doc & SourcePart) | null>>().of('before').of('_id').expr()),
      ext,
    )

export const $merge =
  <V extends O>() =>
  <Out extends Model, SourcePart extends doc>(
    out: RWCollection<Out | Replace<Out, Patch<V>>, Out>,
    keys: ExprsExact<TakeDoc<V, unknown>, SourcePart>,
  ): StreamRunnerParam<Delta<SourcePart>, 'out'> =>
    $mergePart<V>()<Out, SourcePart, {}>(out, keys, {})

const assertNotNull = <T, D, C>(expr: Expr<T | N, D, C>) => expr as Expr<T, D, C>
