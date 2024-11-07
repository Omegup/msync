import type { Arr, O, RORec, Rec, RecHKT } from '../../../../types'
import { $push, subAcc } from '../../../accumulators'
import { $array, $filter, $filterDefined, $first } from '../../../expression/array'
import { field, type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { $ifNull, eq, eqTyped, ite, sub } from '../../../expression/logic'
import { $getField, nil, val } from '../../../expression/val'
import { ctx, root } from '../../../field'
import type { AccumulatorHKT, After, Delta, Expr, RawStages } from '../../../types'
import type {
  DeltaAccumulator,
  DeltaAccumulatorHKT,
  DeltaAccumulators,
} from '../../../types/accumulator'
import { mapExact } from '../../../utils/map-object'
import { $group_, $replaceWith_, $unwind_ } from '../../mongo-stages'
import { link } from '../../prefix'

export type WithItem<V, Grp> = Rec<'_id', Grp> & Rec<'item', O<V>>

export const subGroup = <T extends O, Grp, V extends O, GID extends string>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, V>,
  addGrp: <D extends Rec<'_id', Grp>>(src: ExprsExact<V, D>) => ExprsExact<RORec<GID, Grp> & V, D>,
): RawStages<unknown, Delta<T>, Rec<GID, Grp> & V> => {
  type Part = Rec<'v', T> & RORec<'old', boolean>
  type ComposedId = Rec<'_id', Rec<'old', boolean> & Rec<'id', Grp>>
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

  const arrayToDelta = <P extends string & keyof V>(
    acc: DeltaAccumulator<T, V[P], unknown>,
    k: P,
  ): Expr<V[P], Rec<'item', Arr<WithCmpId>>> =>
    acc.diff(
      $ifNull(
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
        acc.zero,
      ),
      $ifNull(
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
        acc.zero,
      ),
    )

  const grpId: Expr<Grp, WithCmpId> = root<WithCmpId>().of('_id').of('id').expr()

  const replaceWith = <X extends O, A extends O>(expr: Expr<X, A>) => $replaceWith_(expr)

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
      $group_<V>()(
        field({
          old: ['old', root<Part>().of('old').expr()],
          id: ['id', sub(id, root<Part>().of('v'))],
        }),
        mapExact<V, DeltaAccumulatorHKT<T>, AccumulatorHKT<Part>>(args, (v, k) =>
          subAcc<V[typeof k], T, Part>(v, root<Part>().of('v')),
        ),
      ),
    )
    .with<unknown, Rec<'_id', Grp> & HasItem>(
      $group_<Rec<'item', Arr<WithCmpId>>>()(grpId, {
        item: ['item', $push(root<WithCmpId>().expr())],
      }),
    )
    .with<unknown, Rec<GID, Grp> & V>(
      replaceWith(
        field(
          addGrp<Rec<'_id', Grp> & HasItem>(
            mapExact<V, DeltaAccumulatorHKT<T>, ExprHKT<Rec<'item', Arr<WithCmpId>>>>(
              args,
              arrayToDelta,
            ),
          ),
        ),
      ),
    ).stages
}
