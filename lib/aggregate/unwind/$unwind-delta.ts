import type { App, Arr, AsLiteral, doc, HKT, I, ID, N, O, Rec, RORec } from '../../../types'
import { $let, $map0, concat, field, mergeExpr, nil, val, type ExprsExact } from '../../expression'
import { array, concatArray, filter, first, inArray, mergeObjects } from '../../expression/array'
import { $ifNull, eq, eqTyped, ite, not } from '../../expression/logic'
import { ctx, Field, root } from '../../field'
import type {
  BA,
  Deleted,
  DeletedFlags,
  Delta,
  Expr,
  NTrue,
  PreDelta,
  RawStages,
} from '../../types'
import { excludeIdem, literalsEqaul, type Equal } from '../../utils/guard'
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

/** `_id` of a join row for `k`: `k1` / `k2` alone, or `concat` in tuple order. */
export const joinIdOf = <K1 extends s, K2 extends s, D, C = unknown>(
  k: JoinId<K1, K2>,
  k1: K1,
  k1Id: Expr<s, D, C>,
  k2Id: Expr<s, D, C>,
): Expr<s, D, C> => {
  if (k === k1) return k1Id
  if (typeof k === 'string') return k2Id
  const idOf = (key: K1 | K2): Expr<s, D, C> => (key === k1 ? k1Id : k2Id)
  return concat(idOf(k[0]), val<s>(k[1]), idOf(k[2]))
}
/** One unwound slot. `_id` is chosen once, when the slot is built. `{}` means that side is deleted. */
type Slot<X> = PreDelta<X> & ID
/** An item, or an empty-side `{}`, already stamped with its slot id. */
type Key<X> = { readonly _id: s; readonly value: X }
type Keyed<X> = O<Key<X>>
type ManyIn<K1 extends s, T extends doc, K2 extends s, U extends doc, N1 extends null> = Delta<
  Rec<K1, T | N1> & Rec<K2, Arr<U>>
>
/**
 * If `probe` is null, the root is `App<F, null>` and the result is null.
 * Otherwise the root is `App<F, T>` and `keep` (typed at that root) is the result.
 */
const andAlso = <T, V, F extends HKT<null | T>, C = unknown>(
  probe: Expr<null | T, App<F, null | T>, C>,
  keep: Expr<V, App<F, T>, C>,
): Expr<V | null, App<F, null | T>, C> =>
  ite<V | null, null, T, F, C>(eqTyped<null, T, F, C, null | T>(probe, nil), nil, keep)

type DDelta<T> = PreDelta<T> & {
  readonly deleted: DeletedFlags | N
}
/**
 * `$replaceWith`. Pair `k2` into slots and copy `k1` out as its own delta.
 * A missing `k2` array counts as `[]`.
 * `Pad` is `{}` when the right side is outer (`N2` is `null`), otherwise `never`.
 * Only the outer instantiation inserts the `{}` sentinel.
 *
 * Call shape used below: `slotsMany('left', 'right', ['left', '.', 'right'])`.
 * `L` is `{ _id: 'L' }`. `p1` is `{ _id: 'p1', n: 1 }`. `p1b` is `{ _id: 'p1', n: 2 }`.
 * Each item is stamped with its slot `_id` first. Before and after then match on that id.
 * `k === k1` stamps the document id, so `p1` → `p2` is one slot. `k === k2` stamps the item id.
 * A tuple uses `concat` in that order. The `k1` component is the document `_id`, the `k2` component is the item `_id`.
 * An empty outer side is one entry with the document id, so it meets an item only when that item's slot id is the same.
 * `k === k2` is not padded: an empty side has no item id.
 * A `{}` value is the deleted side. The join writes `deleted` from that, not the slot.
 *
 * Both sides empty. `before: null` is the same split as `right: []`. The left id is `L`.
 * ```
 * { _id: 'inv', before: null, after: { left: L, right: [] } }
 * → { _id: 'inv', before: null, after: { left: L, right: [] },
 *     left: { before: null, after: L },
 *     right: [{ _id: 'L', before: {}, after: {} }] }
 * ```
 *
 * `[]` → `[p1]`. The empty side is a disappearing sentinel, not paired with `p1`.
 * ```
 * { _id: 'inv',
 *   before: { left: L, right: [] },
 *   after:  { left: L, right: [p1] } }
 * → right: [{ _id: 'L', before: {}, after: null },
 *           { _id: 'L.p1', before: null, after: p1 }]
 * ```
 *
 * `[p1]` → `[]`. The old item is closed, then a separate appearing sentinel.
 * ```
 * { _id: 'inv',
 *   before: { left: L, right: [p1] },
 *   after:  { left: L, right: [] } }
 * → right: [{ _id: 'L.p1', before: p1, after: null },
 *           { _id: 'L', before: null, after: {} }]
 * ```
 *
 * Same `_id`, changed body. One slot, no sentinel.
 * ```
 * { _id: 'inv',
 *   before: { left: L, right: [p1] },
 *   after:  { left: L, right: [p1b] } }
 * → right: [{ _id: 'L.p1', before: p1, after: p1b }]
 * ```
 *
 * Left id `L` → `M` on that same payment. The slot keeps `before`'s left id.
 * ```
 * { _id: 'inv',
 *   before: { left: L, right: [p1] },
 *   after:  { left: { _id: 'M' }, right: [p1] } }
 * → right: [{ _id: 'L.p1', before: p1, after: p1 }]
 * ```
 *
 * `[p1]` → `[p2]`. Delete plus insert, still no sentinel.
 * ```
 * { _id: 'inv',
 *   before: { left: L, right: [p1] },
 *   after:  { left: L, right: [{ _id: 'p2', n: 1 }] } }
 * → right: [{ _id: 'L.p1', before: p1, after: null },
 *           { _id: 'L.p2', before: null, after: { _id: 'p2', n: 1 } }]
 * ```
 *
 * `left` is copied beside the slots. On the fresh document above it is
 * `{ before: null, after: L }`. On the others it is `{ before: L, after: L }`,
 * except the `L` → `M` case, where `after` is `{ _id: 'M' }`.
 *
 * `k === 'left'`. One slot, id `L`. `p1` → `p2` does not split.
 * ```
 * { before: { left: L, right: [p1] }, after: { left: L, right: [{ _id: 'p2', n: 1 }] } }
 * → right: [{ _id: 'L', before: p1, after: { _id: 'p2', n: 1 } }]
 * ```
 * Outer, `[]` → `[p1]`. The empty side is `{}` on that same slot. The join marks `deleted.before`.
 * ```
 * → right: [{ _id: 'L', before: {}, after: p1 }]
 * ```
 *
 * `k === 'right'`. Id is the payment id. `p1` → `p2` is a delete plus an insert. No sentinel.
 * ```
 * → right: [{ _id: 'p1', before: p1, after: null },
 *           { _id: 'p2', before: null, after: { _id: 'p2', n: 1 } }]
 * ```
 */
const slotsMany = <
  K1 extends s,
  T extends doc,
  KK2 extends s,
  U extends doc,
  N1 extends null = never,
  Pad extends O | never = never,
>(
  k1: AsLiteral<K1>,
  k2: AsLiteral<Exclude<KK2, K1 | BA>>,
  k: JoinId<K1, Exclude<KK2, K1 | BA>>,
  /** Empty side. Outer is one `{ _id: document id, value: {} }`. Inner is `[]`. */
  emptyOf: (
    id: Expr<s, ManyIn<K1, T, Exclude<KK2, K1 | BA>, U, N1>>,
  ) => Expr<Arr<Keyed<U | Pad>>, ManyIn<K1, T, Exclude<KK2, K1 | BA>, U, N1>>,
): RawStages<
  unknown,
  Delta<Rec<K1, T | N1> & Rec<Exclude<KK2, K1 | BA>, Arr<U>>>,
  Rec<K1, DDelta<T | null>> & Rec<Exclude<KK2, K1 | BA>, Arr<Slot<U | Pad | null>>>
> => {
  type K2 = Exclude<KK2, K1 | BA>
  type Pair<A, B> = Rec<K1, A> & Rec<K2, B>
  type In = ManyIn<K1, T, K2, U, N1>
  type K1Delta = DDelta<T | null>
  type K2Delta = Slot<U | Pad | null>
  type Deltas = Pair<K1Delta, Arr<K2Delta>>

  const emptyArr: Expr<Arr<U>, In> = array<U, In>()
  const src: Field<In, In> = root<In>()
  const k2Arr = (side: BA): Expr<Arr<U> | null, In> =>
    src.of<In, BA>(side).of<Pair<T | N1, Arr<U>>, K2, null>(k2).expr()
  const k2OrEmpty = (side: BA): Expr<Arr<U>, In> =>
    $ifNull<Arr<U>, In, unknown>(k2Arr(side), emptyArr)
  const k1Id: Expr<s, In> = root<In>().of<In, '_id'>('_id').expr()
  const k1Delta: Expr<K1Delta, In> = field<K1Delta, In>({
    before: [
      'before',
      $ifNull<T | null, In, unknown>(
        src.of<In, 'before'>('before').of<Pair<T | N1, Arr<U>>, K1, null>(k1).expr(),
        nil,
      ),
    ],
    after: [
      'after',
      $ifNull<T | null, In, unknown>(
        src.of<In, 'after'>('after').of<Pair<T | N1, Arr<U>>, K1, null>(k1).expr(),
        nil,
      ),
    ],
    deleted: ['deleted', src.of('deleted').expr()],
  })
  const itemId = <C>(k2Id: Expr<s, In, C>): Expr<s, In, C> => {
    const at = (key: K1 | K2) => (key === k1 ? k1Id : k2Id)
    if (typeof k === 'string') return at(k)
    return concat<In, C>(at(k[0]), val<s>(k[1]), at(k[2]))
  }
  const keyed = (side: BA): Expr<Arr<Keyed<U | Pad>>, In> => {
    type Items = RORec<'items', Arr<U>>
    const items = ctx<Arr<U>>()('items').expr()
    return $let<Arr<Keyed<U | Pad>>, In, unknown, Items>(
      { items: ['items', k2OrEmpty(side)] },
      ite<Arr<Keyed<U | Pad>>, In, Items>(
        eq<Arr<U>, In, Items>(items)(emptyArr),
        emptyOf(k1Id),
        $map0<'b', U, Keyed<U | Pad>, In, Items>({
          input: items,
          as: 'b',
          expr: field<Key<U | Pad>, In, RORec<'b', U> & Items>({
            _id: ['_id', itemId<RORec<'b', U> & Items>(ctx<U>()('b').of<U, '_id'>('_id').expr())],
            value: ['value', ctx<U>()('b').expr()],
          }),
        }),
      ),
    )
  }
  const beforeKeyed = keyed('before')
  const afterKeyed = keyed('after')
  type KeyedArr = Arr<Keyed<U | Pad>>
  type Vars = RORec<'beforeK' | 'afterK', KeyedArr>
  const bound = <N extends 'beforeK' | 'afterK'>(name: N) => ctx<KeyedArr>()(name).expr()
  const idOf = <N extends 'a' | 'b'>(name: N) =>
    ctx<Keyed<U | Pad>>()(name).of<Key<U | Pad>, '_id', 1>('_id').expr()
  const valueOf = <N extends 'a' | 'b'>(name: N) =>
    ctx<Keyed<U | Pad>>()(name).of<Key<U | Pad>, 'value', 1>('value').expr()
  const kept = $map0<'b', Keyed<U | Pad>, Slot<U | Pad | null>, unknown, Vars>({
    input: bound('beforeK'),
    as: 'b',
    expr: field<Slot<U | Pad | null>, unknown, RORec<'b', Keyed<U | Pad>> & Vars>({
      _id: ['_id', idOf('b')],
      before: ['before', valueOf('b')],
      after: [
        'after',
        first<U | Pad, unknown, RORec<'b', Keyed<U | Pad>> & Vars>(
          $map0<'a', Keyed<U | Pad>, U | Pad, unknown, RORec<'b', Keyed<U | Pad>> & Vars>({
            input: filter<Keyed<U | Pad>, unknown, 'a', RORec<'b', Keyed<U | Pad>> & Vars>({
              expr: bound('afterK'),
              as: 'a',
              limit: val(1),
              cond: eq<s, unknown, RORec<'a' | 'b', Keyed<U | Pad>> & Vars>(idOf('a'))(idOf('b')),
            }),
            as: 'a',
            expr: valueOf('a'),
          }),
        ),
      ],
    }),
  })
  const beforeIds = $map0<'id', Keyed<U | Pad>, s, unknown, Vars>({
    input: bound('beforeK'),
    as: 'id',
    expr: ctx<Keyed<U | Pad>>()('id').of<Key<U | Pad>, '_id', 1>('_id').expr(),
  })
  const added = $map0<'a', Keyed<U | Pad>, Slot<U | Pad | null>, unknown, Vars>({
    input: filter<Keyed<U | Pad>, unknown, 'a', Vars>({
      expr: bound('afterK'),
      as: 'a',
      cond: not<unknown, RORec<'a', Keyed<U | Pad>> & Vars>(
        inArray<s, unknown, RORec<'a', Keyed<U | Pad>> & Vars>(idOf('a'), beforeIds),
      ),
    }),
    as: 'a',
    expr: field<Slot<U | Pad | null>, unknown, RORec<'a', Keyed<U | Pad>> & Vars>({
      _id: ['_id', idOf('a')],
      before: ['before', nil],
      after: ['after', valueOf('a')],
    }),
  })
  const slots = $let<Arr<Slot<U | Pad | null>>, In, unknown, Vars>(
    {
      beforeK: ['beforeK', beforeKeyed],
      afterK: ['afterK', afterKeyed],
    },
    concatArray<Slot<U | Pad | null>, In, Vars>(kept, added),
  )
  const exclude = excludeIdem<KK2, K1 | BA, K1>()
  interface ExprsExactF<T = {}> extends HKT<string> {
    readonly out: ExprsExact<T & RORec<I<string, this>, Arr<K2Delta>>, In>
  }
  return $replaceWith_<In, Deltas>(
    field<RORec<K1, K1Delta> & RORec<K2, Arr<K2Delta>>, In>(
      exclude.backward<ExprsExactF<RORec<K1, K1Delta>>>(
        mergeExpr<RORec<K2, Arr<K2Delta>>, RORec<K1, K1Delta>, In>(
          exclude.forward<ExprsExactF>(map1(k2, slots)),
          map1(k1, k1Delta),
        ),
      ),
    ),
  )
}

/** Inner right: an empty side stays empty. */
const noEmpty = <K1 extends s, T extends doc, K2 extends s, U extends doc, N1 extends null>(
  _id: Expr<s, ManyIn<K1, T, K2, U, N1>>,
): Expr<Arr<Keyed<U>>, ManyIn<K1, T, K2, U, N1>> => array<Keyed<U>, ManyIn<K1, T, K2, U, N1>>()

/** Outer right: an empty side is one `{}` entry, id the document id. */
const padEmpty = <K1 extends s, T extends doc, K2 extends s, U extends doc, N1 extends null>(
  id: Expr<s, ManyIn<K1, T, K2, U, N1>>,
): Expr<Arr<Keyed<U | O>>, ManyIn<K1, T, K2, U, N1>> =>
  array<Keyed<U | O>, ManyIn<K1, T, K2, U, N1>>(
    field<Key<O>, ManyIn<K1, T, K2, U, N1>>({
      _id: ['_id', id],
      value: ['value', field<{}, ManyIn<K1, T, K2, U, N1>>({})],
    }),
  )

/**
 * `$replaceWith`. Rebuild each side of the slot as a join row, or null.
 * The row `_id` is the slot `_id` from `slotsMany`, on both sides.
 * A side whose value is `{}` is marked `deleted`.
 *
 * A null `k2` omits that side. `{}` is stored as a null `k2`.
 * A null `k1` omits the side when the left is inner. When the left is outer, the row stays and `k1` is null.
 *
 * Call shape: `joinMany('left', 'right')`.
 *
 * Fresh empty, inner left. `before` is omitted because `left` is null. The slot id is `L`.
 * Outer left keeps that side: `{ _id: 'L', left: null, right: null }`.
 * ```
 * { _id: 'inv', left: { before: null, after: L },
 *   right: { _id: 'L', before: {}, after: {} } }
 * → { _id: 'inv',
 *     before: null,
 *     after: { _id: 'L', left: L, right: null },
 *     deleted: { before: true, after: true } }
 * ```
 *
 * `[]` → `[p1]`, sentinel slot. `after` is null, not the new payment.
 * ```
 * { _id: 'inv', left: { before: L, after: L },
 *   right: { _id: 'L', before: {}, after: null } }
 * → { _id: 'inv',
 *     before: { _id: 'L', left: L, right: null },
 *     after: null,
 *     deleted: { before: true, after: false } }
 * ```
 *
 * `[]` → `[p1]`, new payment.
 * ```
 * { _id: 'inv', left: { before: L, after: L }, right: { _id: 'L.p1', before: null, after: p1 } }
 * → { _id: 'inv',
 *     before: null,
 *     after: { _id: 'L.p1', left: L, right: p1 } }
 * ```
 *
 * `[p1]` → `[]`, closed payment.
 * ```
 * { _id: 'inv', left: { before: L, after: L }, right: { _id: 'L.p1', before: p1, after: null } }
 * → { _id: 'inv',
 *     before: { _id: 'L.p1', left: L, right: p1 },
 *     after: null }
 * ```
 *
 * `[p1]` → `[]`, appearing sentinel.
 * ```
 * { _id: 'inv', left: { before: L, after: L },
 *   right: { _id: 'L', before: null, after: {} } }
 * → { _id: 'inv',
 *     before: null,
 *     after: { _id: 'L', left: L, right: null },
 *     deleted: { before: false, after: true } }
 * ```
 *
 * `p1` → `p1b`. Both rows copy `L.p1`.
 * ```
 * { _id: 'inv', left: { before: L, after: L }, right: { _id: 'L.p1', before: p1, after: p1b } }
 * → { _id: 'inv',
 *     before: { _id: 'L.p1', left: L, right: p1 },
 *     after:  { _id: 'L.p1', left: L, right: p1b } }
 * ```
 *
 * Left id `L` → `M`. The slot id was fixed as `L.p1`, so both rows use it.
 * ```
 * { _id: 'inv', left: { before: L, after: { _id: 'M' } },
 *   right: { _id: 'L.p1', before: p1, after: p1 } }
 * → { _id: 'inv',
 *     before: { _id: 'L.p1', left: L, right: p1 },
 *     after:  { _id: 'L.p1', left: { _id: 'M' }, right: p1 } }
 * ```
 */
const joinMany = <
  K1 extends s,
  T extends doc,
  K2 extends s,
  U extends doc,
  N1 extends null = never,
  N2 extends null = never,
>(
  k1: AsLiteral<K1>,
  k2: AsLiteral<K2>,
  /** `literalsEqaul<null, N1>(includeNull1)` when the left side is outer. */
  eq1: false | Equal<null, null, N1>,
  /** `literalsEqaul<null, N2>(includeNull2)` when the right side is outer. */
  eq2: false | Equal<null, null, N2>,
): RawStages<
  unknown,
  Rec<K1, DDelta<T | null>> & Rec<K2, Slot<U | O | null>>,
  Delta<(Rec<K1, T | N1> & Rec<K2, U | N2> & ID) | null>
> => {
  type Pair<A, B> = Rec<K1, A> & Rec<K2, B>
  type Row<A, B> = Pair<A, B> & ID
  type Join = Row<T | N1, U | N2>
  type K1Delta = DDelta<T | null>
  type K2Delta = Slot<U | O | null>
  type Doc = Pair<K1Delta, K2Delta>
  interface UnwoundK1 extends HKT<T | null> {
    readonly out: Pair<DDelta<I<T | null, this>>, K2Delta>
  }
  type UnwoundK1K2<X extends U | O | null> = Pair<DDelta<T>, Slot<X>>
  interface UnwoundK1K2F extends HKT<U | O | null> {
    readonly out: UnwoundK1K2<I<U | O | null, this>>
  }
  /** `k1` stays `T | null`. Outer left reads it with `$ifNull`. */
  type UnwoundK2<X extends U | O | null> = Pair<K1Delta, Slot<X>>
  interface UnwoundK2F extends HKT<U | O | null> {
    readonly out: UnwoundK2<I<U | O | null, this>>
  }

  const doc: Field<Doc, Doc> = root<Doc>()
  const id = <D extends Rec<K2, doc>>(): Expr<s, D> => root<D>().of(k2).of('_id').expr()
  const k1At = (side: BA): Expr<T | null, Doc> => doc.of<Doc, K1>(k1).of<K1Delta, BA>(side).expr()
  const rowOf = <A, B, D extends Rec<K2, doc>>(a: Expr<A, D>, b: Expr<B, D>): Expr<Row<A, B>, D> =>
    mergeObjects<ID & Rec<K1, A>, Rec<K2, B>, D>(
      mergeObjects<ID, Rec<K1, A>, D>(
        field<RORec<'_id', s>, D>({ _id: ['_id', id<D>()] }),
        field<RORec<K1, A>, D>(map1(k1, a)),
      ),
      field<RORec<K2, B>, D>(map1(k2, b)),
    )
  const rowPad = <A, D extends Rec<K2, doc>>(
    k1v: Expr<A, D>,
    n2: Equal<null, null, N2>,
  ): Expr<Row<A, N2>, D> => {
    interface Right extends HKT<null> {
      readonly out: Expr<I<null, this>, D>
    }
    return rowOf<A, N2, D>(k1v, n2.forward<Right>(nil))
  }
  const rowReal = <A, D extends Rec<K2, doc>>(
    k1v: Expr<A, D>,
    k2v: Expr<U, D>,
  ): Expr<Row<A, U>, D> => rowOf<A, U, D>(k1v, k2v)
  /** Null `k2` omits the side. `{}` is stored as null when `eq2` is set, otherwise the side is omitted. */
  const k2join = <A, F extends HKT<U | O | null>>(
    raw: Expr<U | O | null, App<F, U | O | null>>,
    orNull: Expr<U | null, App<F, U | null>>,
    pad: Expr<Row<A, N2> | null, App<F, O>>,
    real: Expr<Row<A, U>, App<F, U>>,
  ): Expr<Row<A, U | N2> | null, App<F, U | O | null>> =>
    ite<Row<A, U | N2> | null, O, U | null, F>(
      eqTyped<O, U | null, F, unknown, U | O | null>(raw, field<O, App<F, U | O | null>>({})),
      pad,
      andAlso<U, Row<A, U>, F>(orNull, real),
    )
  const joinAt = (side: BA): Expr<Join | null, Doc> => {
    const k2t = <X extends U | O | null>() =>
      root<UnwoundK1K2<X>>().of<UnwoundK1K2<X>, K2>(k2).of<Slot<X>, BA>(side).expr()
    const k2w = <X extends U | O | null>() =>
      root<App<UnwoundK2F, X>>().of<App<UnwoundK2F, X>, K2>(k2).of<Slot<X>, BA>(side).expr()
    if (!eq1) {
      const k1t = <X extends U | O | null>() =>
        root<Pair<DDelta<T>, Slot<X>>>().of(k1).of<DDelta<T>, BA>(side).expr()
      return andAlso<T, Join | null, UnwoundK1>(
        k1At(side),
        k2join<T, UnwoundK1K2F>(
          k2t<U | O | null>(),
          k2t<U | null>(),
          eq2 ? rowPad(k1t<O>(), eq2) : nil,
          rowReal(k1t<U>(), k2t<U>()),
        ),
      )
    }
    const k1v = <X extends U | O | null>(): Expr<T | N1, App<UnwoundK2F, X>> => {
      type D = App<UnwoundK2F, X>
      interface Left extends HKT<null> {
        readonly out: Expr<I<null, this>, D>
      }
      return $ifNull<T | N1, D, unknown>(
        root<D>().of<D, K1>(k1).of<K1Delta, BA>(side).expr(),
        eq1.forward<Left>(nil),
      )
    }
    return k2join<T | N1, UnwoundK2F>(
      k2w<U | O | null>(),
      k2w<U | null>(),
      eq2 ? rowPad(k1v<O>(), eq2) : nil,
      rowReal(k1v<U>(), k2w<U>()),
    )
  }
  const isPad = (side: BA): Expr<NTrue, Doc> =>
    ite(
      eq<U | O | null, Doc>(doc.of<Doc, K2>(k2).of<K2Delta, BA>(side).expr())(field<{}, Doc>({})),
      val(true),
      doc.of(k1).of<K1Delta, 'deleted', 1>('deleted').of(side).expr(),
    )
  const joinDelta: Expr<Delta<Join | null>, Doc> = field<Rec<BA, Join | null> & Deleted & ID, Doc>({
    _id: ['_id', id()],
    before: ['before', joinAt('before')],
    after: ['after', joinAt('after')],
    deleted: [
      'deleted',
      field<RORec<BA, NTrue>, Doc>({
        before: ['before', isPad('before')],
        after: ['after', isPad('after')],
      }),
    ],
  })

  return $replaceWith_(joinDelta)
}

/**
 * Unwind a lookup delta.
 * `k` is `k1` (to one), `k2`, or a concat tuple in either order.
 * `N1` / `N2` are `null` for an outer side, `never` for an inner side.
 * Pass `includeNull1` as `null` to keep a row whose `k1` is null.
 * Pass `includeNull2` as `null` to pad an empty right array, except when `k === k2`:
 * that id is the item's, so an empty right emits no row. The pad's id is the document id,
 * and it joins an item only when that item's slot id is the same. The pad value `{}` is stored as null.
 * `slotsMany`, then `$unwind`, then `joinMany`, then `matchDelta`.
 */
export const $unwindDelta = <
  K1 extends s,
  T extends doc,
  KK2 extends s,
  U extends doc,
  N1 extends null = never,
  N2 extends null = never,
>(
  k1: AsLiteral<K1>,
  k2: AsLiteral<Exclude<KK2, K1 | BA>>,
  k: JoinId<K1, Exclude<KK2, K1 | BA>>,
  includeNull1?: N1,
  includeNull2?: N2,
): RawStages<
  unknown,
  Delta<Rec<K1, T | N1> & Rec<Exclude<KK2, K1 | BA>, Arr<U>>>,
  Delta<Rec<K1, T | N1> & Rec<Exclude<KK2, K1 | BA>, U | N2> & ID>
> => {
  type K2 = Exclude<KK2, K1 | BA>
  type In = ManyIn<K1, T, K2, U, N1>
  type Join = Rec<K1, T | N1> & Rec<K2, U | N2> & ID
  const stages = <Pad extends O | never>(
    emptyOf: (id: Expr<s, In>) => Expr<Arr<Keyed<U | Pad>>, In>,
    eq1: false | Equal<null, null, N1>,
    eq2: false | Equal<null, null, N2>,
  ) => {
    type Slots = Rec<K1, DDelta<T | null>> & Rec<K2, Arr<Slot<U | Pad | null>>>
    type Unwound = Rec<K1, DDelta<T | null>> & Rec<K2, Slot<U | Pad | null>>
    return link<In>()
      .with<unknown, Slots>(slotsMany<K1, T, KK2, U, N1, Pad>(k1, k2, k, emptyOf))
      .with<unknown, Unwound>($unwind_<Rec<K1, DDelta<T | null>>, K2, Slot<U | Pad | null>, never>(k2))
      .with<unknown, Delta<Join | null>>(joinMany<K1, T, K2, U, N1, N2>(k1, k2, eq1, eq2))
      .with<unknown, Delta<Join>>(matchDelta<Join>()).stages
  }
  const run = <Pad extends O | never>(
    emptyOf: (id: Expr<s, In>) => Expr<Arr<Keyed<U | Pad>>, In>,
  ) =>
    stages<Pad>(
      emptyOf,
      includeNull1 === null && literalsEqaul<null, N1>(includeNull1),
      includeNull2 === null && literalsEqaul<null, N2>(includeNull2),
    )
  if (k === k2) return run<never>(noEmpty)
  if (includeNull2 === null) return run<O>(padEmpty)
  return run<never>(noEmpty)
}
