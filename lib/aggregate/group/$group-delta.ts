import type { Arr, J, O, RORec, Rec, RecHKT, jsonItem } from '../../../types'
import { $push, subAcc } from '../../accumulators'
import { $array, $filter, $filterDefined, $first } from '../../expression/array'
import { field, mergeExprs, type Exprs } from '../../expression/concat'
import { eq, eqTyped, ite, sub } from '../../expression/logic'
import { $getField, nil, val } from '../../expression/val'
import { ctx, root } from '../../field'
import type {
  Accumulator,
  Accumulators,
  After,
  Delta,
  DeltaAccumulators,
  Expr,
  RawStages,
} from '../../types'
import { set, to } from '../../update'
import { map } from '../../utils/map-object'
import { $group_, $replaceWith_, $set_, $unwind_ } from '../mongo-stages'
import { link } from '../prefix'

export const $groupMerge = <
  Q extends J,
  T extends Q,
  ID extends jsonItem,
  V extends RORec<string, jsonItem>,
>(
  id: Expr<ID, T>,
  args: DeltaAccumulators<T, V>,
): RawStages<unknown, Delta<T>, Rec<'_id', ID> & V> => {
  type Part = Rec<'v', T> & RORec<'old', boolean>
  type DeltaV = { [K in keyof V]: Delta<V[K]> }
  type ComposedId = Rec<'_id', Rec<'old', boolean> & Rec<'id', ID>>
  type WithCmpId = ComposedId & V
  
  return link<Delta<T>, unknown>()
    .with<unknown, Rec<'part', Arr<Part>>>(
      $replaceWith_(
        field({
          part: $filterDefined<Part, Delta<T>>(
            $array<Part | null, Delta<T>>(
              ite<Part | null, null, T, RecHKT<'after'>>(
                eqTyped<null, T, RecHKT<'after'>>(root<After<T>>().of('after').expr(), nil),
                nil,
                field<Part, Rec<'after', T>>({
                  v: root<Rec<'after', T>>().of('after').expr(),
                  old: val(false),
                }),
              ),
              ite<Part | null, null, T, RecHKT<'before'>>(
                eqTyped<null, T, RecHKT<'before'>>(
                  root<Rec<'before', T | null>>().of('before').expr(),
                  nil,
                ),
                nil,
                field<Part, Rec<'before', T>>({
                  v: root<Rec<'before', T>>().of('before').expr(),
                  old: val(false),
                }),
              ),
            ),
          ),
        }),
      ),
    )
    .with<unknown, Rec<'part', Part>>($unwind_('part'))
    .with<unknown, Part>($replaceWith_(root<Rec<'part', Part>>().of('part').expr()))
    .with<unknown, WithCmpId>(
      $group_<Part>()<RORec<'old', boolean> & Rec<'id', ID>, V>(
        field({ old: root<Part>().of('old').expr(), id: sub(id, root<Part>().of('v')) }),
        Object.fromEntries(
          Object.entries<Accumulators<T, V>, 0>(args).map(
            <P extends keyof V>([k, v]: [P, Accumulator<T, V[P]>]): [
              P,
              Accumulator<Part, V[P]>,
            ] => [k, subAcc<V[P], T, Part>(v, root<Part>().of('v'))],
          ),
        ),
      ),
    )
    .with<unknown, Rec<'_id', ID> & Rec<'item', Arr<WithCmpId>>>(
      $group_<WithCmpId>()(root<WithCmpId>().of('_id').of('id').expr(), {
        item: $push(root<WithCmpId>().expr()),
      }),
    )
    .with<unknown, Rec<'_id', ID> & Rec<'item', O<DeltaV>>>(
      $set_(
        set({
          item: to<Rec<'_id', ID> & Rec<'item', Arr<WithCmpId>>, O<DeltaV>>(
            field(
              map<
                DeltaAccumulators<T, V, unknown>,
                string & keyof V,
                Exprs<DeltaV, Rec<'item', Arr<WithCmpId>>>
              >(
                args,
                <P extends string & keyof V>(
                  _: unknown,
                  k: P,
                ): Expr<Delta<V[P]>, Rec<'item', Arr<WithCmpId>>> =>
                  field({
                    before: $getField(
                      $first(
                        $filter<WithCmpId, Rec<'item', Arr<WithCmpId>>, 'x'>({
                          as: 'x',
                          cond: eq(ctx<ComposedId>()('x').of('_id').of('old').expr())(val(true)),
                          expr: root<Rec<'item', Arr<WithCmpId>>>().of('item').expr(),
                        }),
                      ),
                      k,
                    ),
                    after: $getField(
                      $first(
                        $filter<WithCmpId, Rec<'item', Arr<WithCmpId>>, 'x'>({
                          as: 'x',
                          cond: eq(ctx<ComposedId>()('x').of('_id').of('old').expr())(val(false)),
                          expr: root<Rec<'item', Arr<WithCmpId>>>().of('item').expr(),
                        }),
                      ),
                      k,
                    ),
                  }),
              ),
            ),
          ),
        }),
      ),
    )
    .with<unknown, Rec<'_id', ID> & V>(
      $replaceWith_<Rec<'_id', ID> & Rec<'item', O<DeltaV>>, V & Rec<'_id', ID>>(
        field<V & Rec<'_id', ID>, Rec<'_id', ID> & Rec<'item', O<DeltaV>>>(
          mergeExprs<Rec<'_id', ID>, V, Rec<'_id', ID> & Rec<'item', O<DeltaV>>>(
            {
              _id: root<Rec<'_id', ID>>().of('_id').expr(),
            },
            map<DeltaAccumulators<T, V>, string & keyof V, Exprs<V, Rec<'item', O<DeltaV>>>>(
              args,
              (arg, p) => sub(arg.diff, root<Rec<'item', O<DeltaV>>>().of('item').of(p)),
            ),
          ),
        ),
      ),
    ).stages
}
