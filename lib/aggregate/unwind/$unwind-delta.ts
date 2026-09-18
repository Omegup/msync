import type { App, Arr, AsLiteral, HKT, I, ID, Rec, RORec, doc, O } from '../../../types'
import {
  $getField,
  $ifNull,
  $map0,
  $map1,
  and,
  array,
  concat,
  concatArray,
  eq,
  eqTyped,
  field,
  filter,
  first,
  inArray,
  ite,
  mergeObjects,
  ne,
  nil,
  not,
  or,
  val,
} from '../../expression'
import { ctx, Field, root } from '../../field'
import { $expr } from '../../predicate'
import type { BA, Deleted, DeletedFlags, Delta, Expr, PreDelta, RawStages } from '../../types'
import { $match_, $replaceWith_, $unwind_ } from '../mongo-stages'
import { link } from '../prefix'
import { map1 } from '../../utils/json'
import { literalsEqaul } from '../../utils/guard'

type s = string

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
 * 2. If outer `k2`, pad empty arrays with `{}` so `$unwind` still emits a row.
 * 3. Attach `{ [k1]: Δ(T|null), [k2]: Δ(U|{}|null)[] }` and `$unwind` `k2`.
 * 4. Rebuild each before/after as a join row, or null if an inner side is missing.
 * 5. Drop rows whose before and after are equal.
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
  k: K1 | K2 | false,
  middle: s,
  reversed: boolean = false,
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
  const k1Slot = <X>(
    fill: Expr<U | X | null, In>,
  ): Expr<Arr<PreDelta<U | X | null>>, In> =>
    array<PreDelta<U | X | null>, In>(
      field<PreDelta<U | X | null>, In>({
        before: ['before', $ifNull<U | X | null, In, unknown>(first<U, In, unknown>(beforeItems), fill)],
        after: ['after', $ifNull<U | X | null, In, unknown>(first<U, In, unknown>(afterItems), fill)],
      }),
    )
  const oldDeltas: Expr<Arr<PreDelta<U | null>>, In> =
    k === k1 ? k1Slot<never>(nil) : oldByK2Id
  const newItems: Expr<Arr<U>, In> = k === k1 ? emptyArr : newByK2Id

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

  const unwindJoin = <Pad>({
    oldDeltas,
    newItems,
    unpad,
    isPad,
    join,
  }: {
    oldDeltas: Expr<Arr<K2Delta<Pad>>, In>
    newItems: Expr<Arr<U | Pad>, In>
    unpad: <F extends HKT<U | Pad | null>>(
      k2: Expr<U | Pad | null, App<F, U | Pad | null>>,
      keep: Expr<U | null, App<F, U | null>>,
    ) => Expr<U | null, App<F, U | Pad | null>>
    isPad: <F extends HKT<U | Pad | null>>(
      k2: Expr<U | Pad | null, App<F, U | Pad | null>>,
    ) => Expr<boolean, App<F, U | Pad | null>>
    join: (parts: {
      k1: Expr<T | null, Unwound<Pad>>
      k2: Expr<U | null, Unwound<Pad>>
      row: Expr<Row<T | null, U | null>, Unwound<Pad>>
      rowK1: Expr<Row<T, U | null>, App<UnwoundK1<Pad>, T>>
      rowK2: Expr<Row<T | null, U>, App<UnwoundK2<Pad>, U>>
      rowK1K2: Expr<Row<T, U>, App<UnwoundK1K2<Pad>, U>>
      k2AtK1: Expr<U | null, App<UnwoundK1<Pad>, T>>
    }) => Expr<Join | null, Unwound<Pad>>
  }): Out => {
    type Delta2 = K2Delta<Pad>
    type Deltas = Pair<K1Delta, Arr<Delta2>>
    type PreUnwind = In & Deltas
    type Doc = Unwound<Pad>

    const newDeltas: Expr<Arr<Delta2>, In> = $map0<'a', U | Pad, Delta2, In, unknown>({
      input: newItems,
      as: 'a',
      expr: field<Delta2, In, RORec<'a', U | Pad>>({
        before: ['before', nil],
        after: ['after', ctx<U | Pad>()('a').expr()],
      }),
    })

    const deltas: Expr<Deltas, In> = mergeObjects<Rec<K1, K1Delta>, Rec<K2, Arr<Delta2>>, In>(
      field<RORec<K1, K1Delta>, In>(map1(k1, k1Delta)),
      field<RORec<K2, Arr<Delta2>>, In>(
        map1(k2, concatArray<Delta2, In, unknown>(oldDeltas, newDeltas)),
      ),
    )

    const idLeft: K1 | K2 = reversed ? k2 : k1
    const idRight: K1 | K2 = reversed ? k1 : k2
    const doc: Field<Doc, Doc> = root<Doc>()
    const parentId: Expr<s, Doc> = doc.of<Doc, '_id'>('_id').expr()
    const k1At = (side: BA): Expr<T | null, Doc> => doc.of<Doc, K1>(k1).of<K1Delta, BA>(side).expr()
    const k2Raw = (side: BA): Expr<U | Pad | null, Doc> =>
      doc.of<Doc, K2>(k2).of<Delta2, BA>(side).expr()

    const docK2Null: Field<App<UnwoundK2<Pad>, U | null>, App<UnwoundK2<Pad>, U | null>> = root<
      App<UnwoundK2<Pad>, U | null>
    >()
    const k2Keep = (side: BA): Expr<U | null, App<UnwoundK2<Pad>, U | null>> =>
      docK2Null.of<App<UnwoundK2<Pad>, U | null>, K2>(k2).of<PreDelta<U | null>, BA>(side).expr()
    const k2At = (side: BA): Expr<U | null, Doc> => unpad<UnwoundK2<Pad>>(k2Raw(side), k2Keep(side))

    const k1Id = (side: BA): Expr<s | null, Doc> =>
      doc.of<Doc, K1>(k1).of<K1Delta, BA>(side).of<T, '_id', null>('_id').expr()
    const k2Id = (side: BA): Expr<s | null, Doc> => $getField<U, '_id', Doc>(k2At(side), '_id')
    const idAt = (key: K1 | K2, side: BA): Expr<s | null, Doc> =>
      key === k1 ? k1Id(side) : k2Id(side)

    const rowOf = <A, B, D>(id: Expr<s, D>, a: Expr<A, D>, b: Expr<B, D>): Expr<Row<A, B>, D> =>
      mergeObjects<ID & Rec<K1, A>, Rec<K2, B>, D>(
        mergeObjects<ID, Rec<K1, A>, D>(
          field<RORec<'_id', s>, D>({ _id: ['_id', id] }),
          field<RORec<K1, A>, D>(map1(k1, a)),
        ),
        field<RORec<K2, B>, D>(map1(k2, b)),
      )

    // `k` names the side whose `_id` to use; `false` concatenates left + middle + right.
    const rowId = (side: BA): Expr<s, Doc> =>
      k
        ? $ifNull<s, Doc, unknown>(idAt(k, side), parentId)
        : $ifNull<s, Doc, unknown>(
            concat<Doc, unknown>(idAt(idLeft, side), val<s>(middle), idAt(idRight, side)),
            $ifNull<s, Doc, unknown>(idAt(idLeft, side), parentId),
          )

    const row = (side: BA): Expr<Row<T | null, U | null>, Doc> =>
      rowOf<T | null, U | null, Doc>(rowId(side), k1At(side), k2At(side))

    // Same row at a root where a side is already known present, so `orNil`'s
    // `keep` is typed at `App<F, T>` rather than `App<F, T | null>`.

    const docK1: Field<App<UnwoundK1<Pad>, T>, App<UnwoundK1<Pad>, T>> = root<
      App<UnwoundK1<Pad>, T>
    >()
    const k1AtK1 = (side: BA): Expr<T, App<UnwoundK1<Pad>, T>> =>
      docK1.of<App<UnwoundK1<Pad>, T>, K1>(k1).of<PreDelta<T>, BA>(side).expr()
    const k2AtK1 = (side: BA): Expr<U | null, App<UnwoundK1<Pad>, T>> => {
      type D = App<UnwoundK1K2<Pad>, U | null>
      const docK1K2Null: Field<D, D> = root<D>()
      return unpad<UnwoundK1K2<Pad>>(
        docK1.of<App<UnwoundK1<Pad>, T>, K2>(k2).of<PreDelta<U | Pad | null>, BA>(side).expr(),
        docK1K2Null.of<D, K2>(k2).of<PreDelta<U | null>, BA>(side).expr(),
      )
    }
    const rowK1 = (side: BA): Expr<Row<T, U | null>, App<UnwoundK1<Pad>, T>> =>
      rowOf<T, U | null, App<UnwoundK1<Pad>, T>>(rowId(side), k1AtK1(side), k2AtK1(side))

    const docK2: Field<App<UnwoundK2<Pad>, U>, App<UnwoundK2<Pad>, U>> = root<
      App<UnwoundK2<Pad>, U>
    >()
    const k1AtK2 = (side: BA): Expr<T | null, App<UnwoundK2<Pad>, U>> =>
      docK2.of<App<UnwoundK2<Pad>, U>, K1>(k1).of<K1Delta, BA>(side).expr()
    const k2AtK2 = (side: BA): Expr<U, App<UnwoundK2<Pad>, U>> =>
      docK2.of<App<UnwoundK2<Pad>, U>, K2>(k2).of<PreDelta<U>, BA>(side).expr()
    const rowK2 = (side: BA): Expr<Row<T | null, U>, App<UnwoundK2<Pad>, U>> =>
      rowOf<T | null, U, App<UnwoundK2<Pad>, U>>(rowId(side), k1AtK2(side), k2AtK2(side))

    const docK1K2: Field<App<UnwoundK1K2<Pad>, U>, App<UnwoundK1K2<Pad>, U>> = root<
      App<UnwoundK1K2<Pad>, U>
    >()
    const k1AtK1K2 = (side: BA): Expr<T, App<UnwoundK1K2<Pad>, U>> =>
      docK1K2.of<App<UnwoundK1K2<Pad>, U>, K1>(k1).of<PreDelta<T>, BA>(side).expr()
    const k2AtK1K2 = (side: BA): Expr<U, App<UnwoundK1K2<Pad>, U>> =>
      docK1K2.of<App<UnwoundK1K2<Pad>, U>, K2>(k2).of<PreDelta<U>, BA>(side).expr()
    const rowK1K2 = (side: BA): Expr<Row<T, U>, App<UnwoundK1K2<Pad>, U>> =>
      rowOf<T, U, App<UnwoundK1K2<Pad>, U>>(rowId(side), k1AtK1K2(side), k2AtK1K2(side))

    const outJoin = (side: BA): Expr<Join | null, Delta<Join>> =>
      root<Delta<Join>>().of<Delta<Join>, BA, null>(side).expr()

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
    const emptyObj: Expr<O<{}>, Doc> = field<{}, Doc>({})
    const deletedFlags: Expr<DeletedFlags, Doc> = mergeObjects<
      Rec<'before', true> | O<{}>,
      Rec<'after', true> | O<{}>,
      Doc
    >(
      ite<Rec<'before', true> | O<{}>, Doc>(
        padded('before'),
        field<RORec<'before', true>, Doc>({ before: ['before', val<true>(true)] }),
        emptyObj,
      ),
      ite<Rec<'after', true> | O<{}>, Doc>(
        padded('after'),
        field<RORec<'after', true>, Doc>({ after: ['after', val<true>(true)] }),
        emptyObj,
      ),
    )
    type JoinCore = Rec<BA, Join | null> & ID
    const joinDelta = (joinAt: (side: BA) => Expr<Join | null, Doc>): Expr<Delta<Join>, Doc> =>
      mergeObjects<JoinCore, Deleted | O<{}>, Doc>(
        field<JoinCore, Doc>({
          _id: ['_id', parentId],
          before: ['before', joinAt('before')],
          after: ['after', joinAt('after')],
        }),
        ite<Deleted | O<{}>, Doc>(
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
        .with<unknown, Delta<Join>>($replaceWith_<Doc, Delta<Join>>(joinDelta(joinAt)))
        .with<unknown, Delta<Join>>(k === false ? liftRowId : link<Delta<Join>>().stages)
        .with<unknown, Delta<Join>>(
          $match_<O, Delta<Join>>(
            $expr<Delta<Join>, unknown>(
              ne<Join | null, Delta<Join>, unknown>(outJoin('before'))(outJoin('after')),
            ),
          ),
        ).stages

    return pipeline(
      (side: BA): Expr<Join | null, Doc> =>
        join({
          k1: k1At(side),
          k2: k2At(side),
          row: row(side),
          rowK1: rowK1(side),
          rowK2: rowK2(side),
          rowK1K2: rowK1K2(side),
          k2AtK1: k2AtK1(side),
        }),
    )
  }

  const noUnpad = <F extends HKT<U | null>>(
    k2: Expr<U | null, App<F, U | null>>,
  ): Expr<U | null, App<F, U | null>> => k2
  const noPad = <F extends HKT<U | null>>(
    _k2: Expr<U | null, App<F, U | null>>,
  ): Expr<boolean, App<F, U | null>> => val(false)

  if (includeNull2 === null) {
    const padObj: Expr<O<{}>, In> = field<{}, In>({})
    const padDelta = (after: Expr<O | null, In>): Expr<PreDelta<U | O | null>, In> =>
      field<PreDelta<U | O | null>, In>({
        before: ['before', padObj],
        after: ['after', after],
      })
    // Outer k2: `$unwind` of [] must still emit a row. `{}` is a sentinel (later mapped to null).
    // [] → []:     one row {before:{}, after:{}}
    // [] → items:  disappearing empty row {before:{}, after:null}, plus new items
    // items → []:  matched {before:item, after:null}, plus appearing empty row `{}`
    const padded = {
      oldDeltas:
        k === k1
          ? k1Slot<O>(padObj)
          : ite<Arr<PreDelta<U | O | null>>, In>(
              k2Empty('before'),
              ite<Arr<PreDelta<U | O | null>>, In>(
                k2Empty('after'),
                array<PreDelta<U | O | null>, In>(padDelta(padObj)),
                array<PreDelta<U | O | null>, In>(padDelta(nil)),
              ),
              oldDeltas,
            ),
      newItems:
        k === k1
          ? array<U | O, In>()
          : ite<Arr<U | O>, In>(
              and<In>(not<In>(k2Empty('before')), k2Empty('after')),
              array<U | O, In>(padObj),
              newItems,
            ),
      unpad: <F extends HKT<U | O | null>>(
        k2: Expr<U | O | null, App<F, U | O | null>>,
        keep: Expr<U | null, App<F, U | null>>,
      ): Expr<U | null, App<F, U | O | null>> =>
        ite<U | null, O, U | null, F>(
          eqTyped<O, U | null, F, unknown, U | O | null>(k2, field<O, App<F, U | O | null>>({})),
          nil,
          keep,
        ),
      isPad: <F extends HKT<U | O | null>>(
        k2: Expr<U | O | null, App<F, U | O | null>>,
      ): Expr<boolean, App<F, U | O | null>> =>
        ite<boolean, O, U | null, F>(
          eqTyped<O, U | null, F, unknown, U | O | null>(k2, field<O, App<F, U | O | null>>({})),
          val(true),
          val(false),
        ),
    }
    if (includeNull1 === null) {
      const eq1 = literalsEqaul<null, N1>(includeNull1)
      const eq2 = literalsEqaul<null, N2>(includeNull2)
      interface RowN1HKT extends HKT<null> {
        readonly out: Expr<Row<T | I<null, this>, U | null>, Unwound<O>>
      }
      interface RowN2HKT extends HKT<null> {
        readonly out: Expr<Row<T | N1, U | I<null, this>>, Unwound<O>>
      }
      return unwindJoin<O>({
        ...padded,
        join: ({ row }): Expr<Join | null, Unwound<O>> =>
          eq2.forward<RowN2HKT>(eq1.forward<RowN1HKT>(row)),
      })
    }
    return unwindJoin<O>({
      ...padded,
      join: ({ k1, rowK1 }): Expr<Join | null, Unwound<O>> =>
        orNil<T, Join, UnwoundK1<O>>(k1, rowK1),
    })
  }

  if (includeNull1 === null) {
    return unwindJoin<never>({
      oldDeltas,
      newItems,
      unpad: noUnpad,
      isPad: noPad,
      join: ({ k2, rowK2 }): Expr<Join | null, Unwound<never>> =>
        orNil<U, Join, UnwoundK2<never>>(k2, rowK2),
    })
  }

  return unwindJoin<never>({
    oldDeltas,
    newItems,
    unpad: noUnpad,
    isPad: noPad,
    join: ({ k1, k2AtK1, rowK1K2 }): Expr<Join | null, Unwound<never>> =>
      orNil<T, Join | null, UnwoundK1<never>>(
        k1,
        orNil<U, Join, UnwoundK1K2<never>>(k2AtK1, rowK1K2),
      ),
  })
}
