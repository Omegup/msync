import type { App, Arr, AsLiteral, doc, HKT, I, ID, O, Rec, RORec } from '../../../types'
import { $map0, $map1, concat, field, nil, val } from '../../expression'
import { array, concatArray, filter, first, inArray, mergeObjects } from '../../expression/array'
import { $ifNull, and, eq, eqTyped, ite, not, or } from '../../expression/logic'
import { ctx, Field, root } from '../../field'
import type { BA, Deleted, DeletedFlags, Delta, Expr, PreDelta, RawStages } from '../../types'
import { literalsEqaul } from '../../utils/guard'
import { map1 } from '../../utils/json'
import { matchDelta } from '../match'
import { $replaceWith_, $unwind_ } from '../mongo-stages'
import { link } from '../prefix'

type s = string

/** Identity of an unwound join row: one side’s `_id`, or a concat of both. */
export type JoinId<K1 extends s, K2 extends s> =
  | K1
  | K2
  | readonly [K1, middle: s, K2]
  | readonly [K2, middle: s, K1]

/**
 * If `probe` is null, the root is `App<F, null>` and the result is null.
 * Otherwise the root is `App<F, T>` and `keep` (typed at that root) is the result.
 */
const orNil = <T, V, F extends HKT<null | T>, C = unknown>(
  probe: Expr<null | T, App<F, null | T>, C>,
  keep: Expr<V, App<F, T>, C>,
): Expr<V | null, App<F, null | T>, C> =>
  ite<V | null, null, T, F, C>(eqTyped<null, T, F, C, null | T>(probe, nil), nil, keep)

/**
 * Delta of `$unwind` on `k2` after a lookup-shaped pair:
 *
 *   in:  Δ { [k1]: T | N1, [k2]: U[] }
 *   out: Δ { [k1]: T | N1, [k2]: U | N2, _id }
 *
 * `N1` / `N2` are `null` for outer join on that side, `never` for inner.
 *
 * 1. Split `k2` arrays into items kept by `_id` vs newly added.
 *    If `k === k1`, pair `first(before)` with `first(after)` as one slot instead
 *    (identity is `k1._id`; a k2 `_id` change must not emit two rows).
 *    A tuple is concat order + separator; pairing still matches by k2 `_id`.
 * 2. If outer `k2`, pad empty arrays with `{}` so `$unwind` still emits a row.
 * 3. Attach `{ [k1]: Δ(T|null), [k2]: Δ(U|{}|null)[] }` and `$unwind` `k2`.
 * 4. Rebuild each before/after. Missing non-pad sides are the whole side null
 *    (no `parentId` fallback). A k2-pad row’s `_id` is `k1._id`; a k1-pad
 *    row’s `_id` is `k2._id`; a complete row’s `_id` is `k`. `k === k1` uses
 *    `k1._id` for both, so a mixed item/pad slot still matches.
 * 5. Drop rows whose before and after are equal.
 *
 * `kept` is `PreDelta<U|null> | PreDelta<Pad|null>` per slot (id-matched or
 * pad-only). A `{before: U, after: {}}` element is not that type. The k1 slot
 * is the one exception (`K1Slot: true` → `PreDelta<U|Pad|null>`).
 */
export const $unwindDelta = <
  K1 extends s,
  T extends doc,
  K2 extends s,
  U extends doc,
  N1 extends null = never,
  N2 extends null = never,
>(
  k1: AsLiteral<K1>,
  k2: AsLiteral<K2>,
  k: JoinId<K1, K2>,
  includeNull1?: N1,
  includeNull2?: N2,
): RawStages<
  unknown,
  Delta<Rec<K1, T | N1> & Rec<K2, Arr<U>>>,
  Delta<Rec<K1, T | N1> & Rec<K2, U | N2> & ID>
> => {
  type K1Val = T | N1
  type Pair<A, B> = Rec<K1, A> & Rec<K2, B>
  type Row<A, B> = Pair<A, B> & ID
  type Join = Row<K1Val, U | N2>
  type In = Delta<Pair<K1Val, Arr<U>>>
  type Out = RawStages<unknown, In, Delta<Join>>
  type K1Delta = PreDelta<T | null>
  /** `Pad` is `{}` if empty `k2` arrays were padded, else `never`. */
  type K2Delta<Pad> = PreDelta<U | Pad | null>
  /** Id-matched item, or a pad-only row. Not `{ before: U, after: {} }`. */
  type KeptDelta<Pad> = PreDelta<U | null> | PreDelta<Pad | null>
  type Unwound<Pad> = In & Pair<K1Delta, K2Delta<Pad>>

  /** Unwound doc as a function of the `k1` slot. */
  interface UnwoundK1<Pad> extends HKT<T | null> {
    readonly out: In & Pair<PreDelta<I<T | null, this>>, K2Delta<Pad>>
  }
  /** Unwound doc as a function of the `k2` slot. */
  interface UnwoundK2<Pad> extends HKT<U | Pad | null> {
    readonly out: In & Pair<K1Delta, PreDelta<I<U | Pad | null, this>>>
  }
  /** `UnwoundK2` after `k1` has already been narrowed to `T`. */
  interface UnwoundK1K2<Pad> extends HKT<U | Pad | null> {
    readonly out: In & Pair<PreDelta<T>, PreDelta<I<U | Pad | null, this>>>
  }
  /** `k2` already present (`U`); `k1` still `T | null`. */
  interface UnwoundK2ThenK1 extends HKT<T | null> {
    readonly out: In & Pair<PreDelta<I<T | null, this>>, PreDelta<U>>
  }
  /** k2-pad (`{}`); `k1` still `T | null`. */
  interface UnwoundK2PadThenK1 extends HKT<T | null> {
    readonly out: In & Pair<PreDelta<I<T | null, this>>, PreDelta<O>>
  }

  const emptyArr: Expr<Arr<U>, In> = array<U, In>()
  const src: Field<In, In> = root<In>()
  const k2Arr = (side: BA): Expr<Arr<U> | null, In> =>
    src.of<In, BA>(side).of<Pair<K1Val, Arr<U>>, K2, null>(k2).expr()
  const k2OrEmpty = (side: BA): Expr<Arr<U>, In> =>
    $ifNull<Arr<U>, In, unknown>(k2Arr(side), emptyArr)
  const k2Empty = (side: BA): Expr<boolean, In> => eq<Arr<U> | null, In>(k2Arr(side))(emptyArr)

  const beforeItems: Expr<Arr<U>, In> = k2OrEmpty('before')
  const afterItems: Expr<Arr<U>, In> = k2OrEmpty('after')
  const beforeIds: Expr<Arr<s>, In> = $map1<U, s, In, unknown>(
    beforeItems,
    (item: Field<unknown, U, RORec<'item', U>>): Expr<s, In, RORec<'item', U>> =>
      item.of<U, '_id'>('_id').expr(),
  )

  const newByK2Id: Expr<Arr<U>, In> = filter<U, In, 'a'>({
    expr: afterItems,
    as: 'a',
    cond: not<In, RORec<'a', U>>(
      inArray<s, In, RORec<'a', U>>(ctx<U>()('a').of<U, '_id'>('_id').expr(), beforeIds),
    ),
  })

  const oldByK2Id: Expr<Arr<PreDelta<U | null>>, In> = $map0<
    'b',
    U,
    PreDelta<U | null>,
    In,
    unknown
  >({
    input: beforeItems,
    as: 'b',
    expr: field<PreDelta<U | null>, In, RORec<'b', U>>({
      before: ['before', ctx<U>()('b').expr()],
      after: [
        'after',
        first<U, In, RORec<'b', U>>(
          filter<U, In, 'a', RORec<'b', U>>({
            expr: afterItems,
            as: 'a',
            cond: eq<s, In, RORec<'a' | 'b', U>>(ctx<U>()('a').of<U, '_id'>('_id').expr())(
              ctx<U>()('b').of<U, '_id'>('_id').expr(),
            ),
          }),
        ),
      ],
    }),
  })

  // `k === k1`: one row per parent. Pair the (at most one) k2 on each side;
  // do not match by k2 `_id` or a pointer change becomes delete+insert of `k1._id`.
  const k1Slot = <X>(fill: Expr<U | X | null, In>): Expr<Arr<PreDelta<U | X | null>>, In> =>
    array<PreDelta<U | X | null>, In>(
      field<PreDelta<U | X | null>, In>({
        before: [
          'before',
          $ifNull<U | X | null, In, unknown>(first<U, In, unknown>(beforeItems), fill),
        ],
        after: [
          'after',
          $ifNull<U | X | null, In, unknown>(first<U, In, unknown>(afterItems), fill),
        ],
      }),
    )
  const kept: Expr<Arr<PreDelta<U | null>>, In> = k === k1 ? k1Slot<never>(nil) : oldByK2Id
  const added: Expr<Arr<U>, In> = k === k1 ? emptyArr : newByK2Id

  const k1Delta: Expr<K1Delta, In> = field<K1Delta, In>({
    before: [
      'before',
      $ifNull<T | null, In, unknown>(
        src.of<In, 'before'>('before').of<Pair<K1Val, Arr<U>>, K1, null>(k1).expr(),
        nil,
      ),
    ],
    after: [
      'after',
      $ifNull<T | null, In, unknown>(
        src.of<In, 'after'>('after').of<Pair<K1Val, Arr<U>>, K1, null>(k1).expr(),
        nil,
      ),
    ],
  })

  type JoinParts<Pad> = {
    k1: Expr<T | null, Unwound<Pad>>
    k2: Expr<U | null, Unwound<Pad>>
    rowK1K2: Expr<Row<T, U>, In & Pair<PreDelta<T>, PreDelta<U>>>
    k2PadRow: Expr<Row<T, null>, In & Pair<PreDelta<T>, PreDelta<Pad>>>
    k1PadRow: Expr<Row<null, U>, In & Pair<PreDelta<null>, PreDelta<U>>>
    k2RawK1: Expr<U | Pad | null, In & Pair<PreDelta<T>, K2Delta<Pad>>>
    k2KeepK1K2: Expr<U | null, In & Pair<PreDelta<T>, PreDelta<U | null>>>
    k1AtK2: Expr<T | null, In & Pair<K1Delta, PreDelta<U>>>
    k2Raw: Expr<U | Pad | null, Unwound<Pad>>
    k2Keep: Expr<U | null, In & Pair<K1Delta, PreDelta<U | null>>>
    k1AtK2Pad: Expr<T | null, In & Pair<K1Delta, PreDelta<Pad>>>
  }

  const unwindJoin = <Pad, K1Slot extends boolean = false>({
    kept,
    added,
    padToNull,
    isPad,
    join,
  }: {
    /** Id-matched `U` deltas, or pad-only rows. `K1Slot` allows one mixed item/pad slot. */
    kept: Expr<Arr<K1Slot extends true ? K2Delta<Pad> : KeptDelta<Pad>>, In>
    /** k2 values that exist only in after (inserts, or a `{}` when after became []). */
    added: Expr<Arr<U | Pad>, In>
    /** `{}` → null; a real item (or null) is left as-is. */
    padToNull: <F extends HKT<U | Pad | null>>(
      k2: Expr<U | Pad | null, App<F, U | Pad | null>>,
      keep: Expr<U | null, App<F, U | null>>,
    ) => Expr<U | null, App<F, U | Pad | null>>
    /** True when this unwound k2 is the `{}` sentinel. */
    isPad: <F extends HKT<U | Pad | null>>(
      k2: Expr<U | Pad | null, App<F, U | Pad | null>>,
    ) => Expr<boolean, App<F, U | Pad | null>>
    /** This before/after as a join row, or null to omit the side. */
    join: (parts: JoinParts<Pad>) => Expr<Join | null, Unwound<Pad>>
  }): Out => {
    type Delta2 = K2Delta<Pad>
    type Deltas = Pair<K1Delta, Arr<Delta2>>
    type PreUnwind = In & Deltas
    type Doc = Unwound<Pad>
    type K1T = In & Pair<PreDelta<T>, K2Delta<Pad>>
    type K2U = In & Pair<K1Delta, PreDelta<U>>
    type Both = In & Pair<PreDelta<T>, PreDelta<U>>
    type K2UNull = In & Pair<K1Delta, PreDelta<U | null>>
    type K1T_K2UNull = In & Pair<PreDelta<T>, PreDelta<U | null>>
    type K2PadDoc = In & Pair<K1Delta, PreDelta<Pad>>
    type K1T_K2Pad = In & Pair<PreDelta<T>, PreDelta<Pad>>
    type K1Null_K2U = In & Pair<PreDelta<null>, PreDelta<U>>

    const newDeltas: Expr<Arr<Delta2>, In> = $map0<'a', U | Pad, Delta2, In, unknown>({
      input: added,
      as: 'a',
      expr: field<Delta2, In, RORec<'a', U | Pad>>({
        before: ['before', nil],
        after: ['after', ctx<U | Pad>()('a').expr()],
      }),
    })

    const deltas: Expr<Deltas, In> = mergeObjects<Rec<K1, K1Delta>, Rec<K2, Arr<Delta2>>, In>(
      field<RORec<K1, K1Delta>, In>(map1(k1, k1Delta)),
      field<RORec<K2, Arr<Delta2>>, In>(
        map1(k2, concatArray<Delta2, In, unknown>(kept, newDeltas)),
      ),
    )

    const doc: Field<Doc, Doc> = root<Doc>()
    const parentId: Expr<s, Doc> = doc.of<Doc, '_id'>('_id').expr()
    const k1At = (side: BA): Expr<T | null, Doc> => doc.of<Doc, K1>(k1).of<K1Delta, BA>(side).expr()
    const k2Raw = (side: BA): Expr<U | Pad | null, Doc> =>
      doc.of<Doc, K2>(k2).of<Delta2, BA>(side).expr()

    const docK2Null: Field<K2UNull, K2UNull> = root<K2UNull>()
    const k2Keep = (side: BA): Expr<U | null, K2UNull> =>
      docK2Null.of<K2UNull, K2>(k2).of<PreDelta<U | null>, BA>(side).expr()
    const k2At = (side: BA): Expr<U | null, Doc> =>
      padToNull<UnwoundK2<Pad>>(k2Raw(side), k2Keep(side))

    const rowOf = <A, B, D>(id: Expr<s, D>, a: Expr<A, D>, b: Expr<B, D>): Expr<Row<A, B>, D> =>
      mergeObjects<ID & Rec<K1, A>, Rec<K2, B>, D>(
        mergeObjects<ID, Rec<K1, A>, D>(
          field<RORec<'_id', s>, D>({ _id: ['_id', id] }),
          field<RORec<K1, A>, D>(map1(k1, a)),
        ),
        field<RORec<K2, B>, D>(map1(k2, b)),
      )

    const docK1: Field<K1T, K1T> = root<K1T>()
    const k2RawK1 = (side: BA): Expr<U | Pad | null, K1T> =>
      docK1.of<K1T, K2>(k2).of<K2Delta<Pad>, BA>(side).expr()
    const k2KeepK1K2 = (side: BA): Expr<U | null, K1T_K2UNull> =>
      root<K1T_K2UNull>().of<K1T_K2UNull, K2>(k2).of<PreDelta<U | null>, BA>(side).expr()
    const k2PadRow = (side: BA): Expr<Row<T, null>, K1T_K2Pad> => {
      const r: Field<K1T_K2Pad, K1T_K2Pad> = root<K1T_K2Pad>()
      const t = r.of<K1T_K2Pad, K1>(k1).of<PreDelta<T>, BA>(side)
      return rowOf<T, null, K1T_K2Pad>(t.of<T, '_id'>('_id').expr(), t.expr(), nil)
    }

    const docK2: Field<K2U, K2U> = root<K2U>()
    const k1AtK2 = (side: BA): Expr<T | null, K2U> =>
      docK2.of<K2U, K1>(k1).of<K1Delta, BA>(side).expr()
    const k1AtK2Pad = (side: BA): Expr<T | null, K2PadDoc> =>
      root<K2PadDoc>().of<K2PadDoc, K1>(k1).of<K1Delta, BA>(side).expr()

    const k1PadRow = (side: BA): Expr<Row<null, U>, K1Null_K2U> => {
      const r: Field<K1Null_K2U, K1Null_K2U> = root<K1Null_K2U>()
      const u = r.of<K1Null_K2U, K2>(k2).of<PreDelta<U>, BA>(side)
      return rowOf<null, U, K1Null_K2U>(u.of<U, '_id'>('_id').expr(), nil, u.expr())
    }

    const docK1K2: Field<Both, Both> = root<Both>()
    const k1AtK1K2 = (side: BA): Expr<T, Both> =>
      docK1K2.of<Both, K1>(k1).of<PreDelta<T>, BA>(side).expr()
    const k2AtK1K2 = (side: BA): Expr<U, Both> =>
      docK1K2.of<Both, K2>(k2).of<PreDelta<U>, BA>(side).expr()
    const k1IdK1K2 = (side: BA): Expr<s, Both> =>
      docK1K2.of<Both, K1>(k1).of<PreDelta<T>, BA>(side).of<T, '_id'>('_id').expr()
    const k2IdK1K2 = (side: BA): Expr<s, Both> =>
      docK1K2.of<Both, K2>(k2).of<PreDelta<U>, BA>(side).of<U, '_id'>('_id').expr()
    const idAtK1K2 = (key: K1 | K2, side: BA): Expr<s, Both> =>
      key === k1 ? k1IdK1K2(side) : k2IdK1K2(side)
    const completeId = (side: BA): Expr<s, Both> => {
      if (k === k1) return k1IdK1K2(side)
      if (typeof k === 'string') return k2IdK1K2(side)
      return concat<Both, unknown>(idAtK1K2(k[0], side), val<s>(k[1]), idAtK1K2(k[2], side))
    }
    const rowK1K2 = (side: BA): Expr<Row<T, U>, Both> =>
      rowOf<T, U, Both>(completeId(side), k1AtK1K2(side), k2AtK1K2(side))


    // Composite `_id` lives on the join row; copy it up to the delta document.
    const liftRowId: RawStages<unknown, Delta<Join>, Delta<Join>> = $replaceWith_<
      Delta<Join>,
      Delta<Join>
    >(
      mergeObjects<Delta<Join>, ID, Delta<Join>>(
        root<Delta<Join>>().expr(),
        field<RORec<'_id', s>, Delta<Join>>({
          _id: [
            '_id',
            $ifNull<s, Delta<Join>, unknown>(
              root<Delta<Join>>()
                .of<Delta<Join>, 'before'>('before')
                .of<Join, '_id', null>('_id')
                .expr(),
              root<Delta<Join>>()
                .of<Delta<Join>, 'after'>('after')
                .of<Join, '_id', null>('_id')
                .expr(),
              root<Delta<Join>>().of<Delta<Join>, '_id'>('_id').expr(),
            ),
          ],
        }),
      ),
    )

    const padded = (side: BA): Expr<boolean, Doc> => isPad<UnwoundK2<Pad>>(k2Raw(side))
    const emptyObj: Expr<O, Doc> = field<{}, Doc>({})
    const deletedFlags: Expr<DeletedFlags, Doc> = mergeObjects<
      Rec<'before', true> | O,
      Rec<'after', true> | O,
      Doc
    >(
      ite<Rec<'before', true> | O, Doc>(
        padded('before'),
        field<RORec<'before', true>, Doc>({ before: ['before', val<true>(true)] }),
        emptyObj,
      ),
      ite<Rec<'after', true> | O, Doc>(
        padded('after'),
        field<RORec<'after', true>, Doc>({ after: ['after', val<true>(true)] }),
        emptyObj,
      ),
    )
    type JoinCore = Rec<BA, Join | null> & ID
    const joinDelta = (
      joinAt: (side: BA) => Expr<Join | null, Doc>,
    ): Expr<Delta<Join | null>, Doc> =>
      mergeObjects<JoinCore, Deleted | O, Doc>(
        field<JoinCore, Doc>({
          _id: ['_id', parentId],
          before: ['before', joinAt('before')],
          after: ['after', joinAt('after')],
        }),
        ite<Deleted | O, Doc>(
          or<Doc>(padded('before'), padded('after')),
          field<Deleted, Doc>({ deleted: ['deleted', deletedFlags] }),
          emptyObj,
        ),
      )

    const pipeline = (joinAt: (side: BA) => Expr<Join | null, Doc>): Out =>
      link<In>()
        .with<unknown, PreUnwind>(
          $replaceWith_<In, PreUnwind>(mergeObjects<In, Deltas, In>(src.expr(), deltas)),
        )
        .with<unknown, Doc>($unwind_<In & Rec<K1, K1Delta>, K2, Delta2>(k2))
        .with<unknown, Delta<Join | null>>($replaceWith_(joinDelta(joinAt)))
        .with<unknown, Delta<Join>>(matchDelta())
        .with<unknown, Delta<Join>>(liftRowId).stages

    return pipeline(
      (side: BA): Expr<Join | null, Doc> =>
        join({
          k1: k1At(side),
          k2: k2At(side),
          rowK1K2: rowK1K2(side),
          k2PadRow: k2PadRow(side),
          k1PadRow: k1PadRow(side),
          k2RawK1: k2RawK1(side),
          k2KeepK1K2: k2KeepK1K2(side),
          k1AtK2: k1AtK2(side),
          k2Raw: k2Raw(side),
          k2Keep: k2Keep(side),
          k1AtK2Pad: k1AtK2Pad(side),
        }),
    )
  }

  const noPadToNull = <F extends HKT<U | null>>(
    k2: Expr<U | null, App<F, U | null>>,
  ): Expr<U | null, App<F, U | null>> => k2
  const neverPad = <F extends HKT<U | null>>(
    _k2: Expr<U | null, App<F, U | null>>,
  ): Expr<boolean, App<F, U | null>> => val(false)

  if (includeNull2 === null) {
    const padObj: Expr<O, In> = field<{}, In>({})
    const padDelta = (after: Expr<O | null, In>): Expr<PreDelta<O | null>, In> =>
      field<PreDelta<O | null>, In>({
        before: ['before', padObj],
        after: ['after', after],
      })
    // Outer k2: `$unwind` of [] must still emit a row. `{}` is a sentinel (later mapped to null).
    // [] → []:     one row {before:{}, after:{}}
    // [] → items:  disappearing empty row {before:{}, after:null}, plus new items
    // items → []:  matched {before:item, after:null}, plus appearing empty row `{}`
    const addedPadded: Expr<Arr<U | O>, In> =
      k === k1
        ? array<U | O, In>()
        : ite<Arr<U | O>, In>(
            and<In>(not<In>(k2Empty('before')), k2Empty('after')),
            array<U | O, In>(padObj),
            added,
          )
    const padToNull = <F extends HKT<U | O | null>>(
      k2: Expr<U | O | null, App<F, U | O | null>>,
      keep: Expr<U | null, App<F, U | null>>,
    ): Expr<U | null, App<F, U | O | null>> =>
      ite<U | null, O, U | null, F>(
        eqTyped<O, U | null, F, unknown, U | O | null>(k2, field<O, App<F, U | O | null>>({})),
        nil,
        keep,
      )
    const isPad = <F extends HKT<U | O | null>>(
      k2: Expr<U | O | null, App<F, U | O | null>>,
    ): Expr<boolean, App<F, U | O | null>> =>
      ite<boolean, O, U | null, F>(
        eqTyped<O, U | null, F, unknown, U | O | null>(k2, field<O, App<F, U | O | null>>({})),
        val(true),
        val(false),
      )
    const keptMatched: Expr<Arr<KeptDelta<O>>, In> = ite<Arr<KeptDelta<O>>, In>(
      k2Empty('before'),
      ite<Arr<KeptDelta<O>>, In>(
        k2Empty('after'),
        array<PreDelta<O | null>, In>(padDelta(padObj)),
        array<PreDelta<O | null>, In>(padDelta(nil)),
      ),
      kept,
    )
    const padded = { added: addedPadded, padToNull, isPad }
    if (includeNull1 === null) {
      const eq1 = literalsEqaul<null, N1>(includeNull1)
      const eq2 = literalsEqaul<null, N2>(includeNull2)
      interface JoinN1HKT extends HKT<null> {
        readonly out: Expr<Row<T | I<null, this>, U | null> | null, Unwound<O>>
      }
      interface JoinN2HKT extends HKT<null> {
        readonly out: Expr<Row<T | N1, U | I<null, this>> | null, Unwound<O>>
      }
      const join = ({
        k2Raw,
        k2Keep,
        k1AtK2Pad,
        k1AtK2,
        k2PadRow,
        k1PadRow,
        rowK1K2,
      }: JoinParts<O>): Expr<Join | null, Unwound<O>> =>
        eq2.forward<JoinN2HKT>(
          eq1.forward<JoinN1HKT>(
            ite<Row<T | null, U | null> | null, O, U | null, UnwoundK2<O>>(
              eqTyped<O, U | null, UnwoundK2<O>, unknown, U | O | null>(
                k2Raw,
                field<O, Unwound<O>>({}),
              ),
              orNil<T, Row<T, null>, UnwoundK2PadThenK1>(k1AtK2Pad, k2PadRow),
              orNil<U, Row<T | null, U>, UnwoundK2<O>>(
                k2Keep,
                ite<Row<T | null, U>, null, T, UnwoundK2ThenK1>(
                  eqTyped<null, T, UnwoundK2ThenK1, unknown, T | null>(k1AtK2, nil),
                  k1PadRow,
                  rowK1K2,
                ),
              ),
            ),
          ),
        )
      return k === k1
        ? unwindJoin<O, true>({ ...padded, kept: k1Slot<O>(padObj), join })
        : unwindJoin<O>({ ...padded, kept: keptMatched, join })
    }
    const join = ({
      k1,
      rowK1K2,
      k2RawK1,
      k2KeepK1K2,
      k2PadRow,
    }: JoinParts<O>): Expr<Join | null, Unwound<O>> =>
      orNil<T, Join | null, UnwoundK1<O>>(
        k1,
        ite<Join | null, O, U | null, UnwoundK1K2<O>>(
          eqTyped<O, U | null, UnwoundK1K2<O>, unknown, U | O | null>(
            k2RawK1,
            field<O, In & Pair<PreDelta<T>, K2Delta<O>>>({}),
          ),
          k2PadRow,
          orNil<U, Join, UnwoundK1K2<O>>(k2KeepK1K2, rowK1K2),
        ),
      )
    return k === k1
      ? unwindJoin<O, true>({ ...padded, kept: k1Slot<O>(padObj), join })
      : unwindJoin<O>({ ...padded, kept: keptMatched, join })
  }

  if (includeNull1 === null) {
    const eq1 = literalsEqaul<null, N1>(includeNull1)
    return unwindJoin<never>({
      kept,
      added,
      padToNull: noPadToNull,
      isPad: neverPad,
      join: ({ k2, rowK1K2, k1AtK2, k1PadRow }): Expr<Join | null, Unwound<never>> => {
        interface CompleteN1HKT extends HKT<null> {
          readonly out: Expr<Row<T | I<null, this>, U>, In & Pair<PreDelta<T>, PreDelta<U>>>
        }
        interface Pad1N1HKT extends HKT<null> {
          readonly out: Expr<Row<I<null, this>, U>, In & Pair<PreDelta<null>, PreDelta<U>>>
        }
        return orNil<U, Join, UnwoundK2<never>>(
          k2,
          ite<Join, null, T, UnwoundK2ThenK1>(
            eqTyped<null, T, UnwoundK2ThenK1, unknown, T | null>(k1AtK2, nil),
            eq1.forward<Pad1N1HKT>(k1PadRow),
            eq1.forward<CompleteN1HKT>(rowK1K2),
          ),
        )
      },
    })
  }

  return unwindJoin<never>({
    kept,
    added,
    padToNull: noPadToNull,
    isPad: neverPad,
    join: ({ k1, k2KeepK1K2, rowK1K2 }): Expr<Join | null, Unwound<never>> =>
      orNil<T, Join | null, UnwoundK1<never>>(
        k1,
        orNil<U, Join, UnwoundK1K2<never>>(k2KeepK1K2, rowK1K2),
      ),
  })
}
