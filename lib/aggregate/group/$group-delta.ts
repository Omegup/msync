import type { Arr, HKT, I, J, O, RORec, Rec, RecHKT, jsonItem } from '../../../types'
import { $push, subAcc } from '../../accumulators'
import { $array, $filter, $filterDefined, $first } from '../../expression/array'
import { field, mergeExpr, pair, type ExprHKT, type ExprsExact } from '../../expression/concat'
import { eq, eqTyped, ite, sub } from '../../expression/logic'
import { $getField, nil, val } from '../../expression/val'
import { ctx, root } from '../../field'
import type { After, Delta, Expr, RawStages } from '../../types'
import type {
  AccumulatorHKT,
  DeltaAccumulatorHKT,
  DeltaAccumulators,
} from '../../types/accumulator'
import { set, to } from '../../update'
import { omitPick } from '../../utils/guard'
import { map, mapExact } from '../../utils/map-object'
import { $group_, $replaceWith_, $set_, $unwind_ } from '../mongo-stages'
import { link } from '../prefix'

const fieldArg = <
  Q extends J,
  T extends Q,
  ID extends jsonItem,
  VV extends RORec<string, jsonItem>,
>(
  args: DeltaAccumulators<T, Omit<VV, '_id'>>,
) => {
  type V = Omit<VV, '_id'>
  type DeltaV = { [K in keyof V]: Delta<V[K]> }
  interface F<E> extends HKT {
    readonly out: ExprsExact<E & I<unknown, this>, Rec<'_id', ID> & Rec<'item', O<DeltaV>>>
  }

  const omit = <E = RORec<'_id', ID>>() => omitPick<keyof VV, '_id', '_id', VV, F<E>>()

  return omit().backward(
    mergeExpr<V, RORec<'_id', ID>, Rec<'_id', ID> & Rec<'item', O<DeltaV>>, unknown, O>(
      omit<unknown>().forward(
        mapExact<V, DeltaAccumulatorHKT<T>, ExprHKT<Rec<'_id', ID> & Rec<'item', O<DeltaV>>>>(
          args,
          (arg, p) => sub(arg.diff, root<Rec<'item', O<DeltaV>>>().of('item').of(p)),
        ),
      ),
      {
        _id: ['_id', root<Rec<'_id', ID>>().of('_id').expr()],
      },
    ),
  )
}

export const $groupMerge = <
  Q extends J,
  T extends Q,
  ID extends jsonItem,
  VV extends RORec<string, jsonItem>,
>(
  id: Expr<ID, T>,
  args: DeltaAccumulators<T, Omit<VV, '_id'>>,
): RawStages<unknown, Delta<T>, Rec<'_id', ID> & Omit<VV, '_id'>> =>
  groupMerge(id, args, fieldArg(args))
export const groupMerge = <
  Q extends J,
  T extends Q,
  ID extends jsonItem,
  V extends RORec<string, jsonItem>,
>(
  id: Expr<ID, T>,
  args: DeltaAccumulators<T, V>,
  fieldArg: ExprsExact<
    V & RORec<'_id', ID>,
    Rec<'_id', ID> & Rec<'item', O<{ [K in keyof V]: Delta<V[K]> }>>
  >,
): RawStages<unknown, Delta<T>, Rec<'_id', ID> & V> => {
  type Part = Rec<'v', T> & RORec<'old', boolean>
  type DeltaV = { [K in keyof V]: Delta<V[K]> }
  type ComposedId = Rec<'_id', Rec<'old', boolean> & Rec<'id', ID>>
  type WithCmpId = ComposedId & V
  type HasItem = Rec<'item', Arr<WithCmpId>>

  const part = $filterDefined<Part, Delta<T>>(
    $array<Part | null, Delta<T>>(
      ite<Part | null, null, T, RecHKT<'after'>>(
        eqTyped<null, T, RecHKT<'after'>>(root<After<T>>().of('after').expr(), nil),
        nil,
        field<Part, Rec<'after', T>>({
          v: ['v', root<Rec<'after', T>>().of('after').expr()],
          old: ['old', val(false)],
        }),
      ),
      ite<Part | null, null, T, RecHKT<'before'>>(
        eqTyped<null, T, RecHKT<'before'>>(
          root<Rec<'before', T | null>>().of('before').expr(),
          nil,
        ),
        nil,
        field<Part, Rec<'before', T>>({
          v: ['v', root<Rec<'before', T>>().of('before').expr()],
          old: ['old', val(false)],
        }),
      ),
    ),
  )

  const arrayToDelta = <P extends string & keyof V>(_: unknown, k: P) =>
    pair<DeltaV, HasItem, unknown, P>(
      k,
      field<Delta<V[P]>, HasItem>({
        before: [
          'before',
          $getField(
            $first(
              $filter<WithCmpId, HasItem, 'x'>({
                as: 'x',
                cond: eq(ctx<ComposedId>()('x').of('_id').of('old').expr())(val(true)),
                expr: root<HasItem>().of('item').expr(),
              }),
            ),
            k,
          ),
        ],
        after: [
          'after',
          $getField(
            $first(
              $filter<WithCmpId, HasItem, 'x'>({
                as: 'x',
                cond: eq(ctx<ComposedId>()('x').of('_id').of('old').expr())(val(false)),
                expr: root<HasItem>().of('item').expr(),
              }),
            ),
            k,
          ),
        ],
      }),
    )

  return link<Delta<T>, unknown>()
    .with<unknown, Rec<'part', Arr<Part>>>(
      $replaceWith_(
        field({
          part: ['part', part],
        }),
      ),
    )
    .with<unknown, Rec<'part', Part>>($unwind_('part'))
    .with<unknown, Part>($replaceWith_(root<Rec<'part', Part>>().of('part').expr()))
    .with<unknown, WithCmpId>(
      $group_<Part>()<RORec<'old', boolean> & Rec<'id', ID>, V>(
        field({
          old: ['old', root<Part>().of('old').expr()],
          id: ['id', sub(id, root<Part>().of('v'))],
        }),
        mapExact<V, DeltaAccumulatorHKT<T>, AccumulatorHKT<Part>>(args, (v, k) =>
          subAcc<V[typeof k], T, Part>(v, root<Part>().of('v')),
        ),
      ),
    )
    .with<unknown, Rec<'_id', ID> & HasItem>(
      $group_<WithCmpId>()(root<WithCmpId>().of('_id').of('id').expr(), {
        item: ['item', $push(root<WithCmpId>().expr())],
      }),
    )
    .with<unknown, Rec<'_id', ID> & Rec<'item', O<DeltaV>>>(
      $set_(
        set({
          item: to<Rec<'_id', ID> & HasItem, O<DeltaV>>(field(map(args, arrayToDelta))),
        }),
      ),
    )
    .with<unknown, Rec<'_id', ID> & V>(
      $replaceWith_<Rec<'_id', ID> & Rec<'item', O<DeltaV>>, V & Rec<'_id', ID>>(
        field<V & RORec<'_id', ID>, Rec<'_id', ID> & Rec<'item', O<DeltaV>>>(fieldArg),
      ),
    ).stages
}
