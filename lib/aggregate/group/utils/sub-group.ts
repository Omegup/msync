import type { Arr, ID, O, RORec, Rec, RecHKT } from '../../../../types'
import { array, filterDefined } from '../../../expression/array'
import { field, type ExprHKT, type ExprsExact } from '../../../expression/concat'
import { eqTyped, ite, sub } from '../../../expression/logic'
import { $getField, nil, val } from '../../../expression/val'
import { root } from '../../../field'
import type { AccumulatorHKT, After, Deleted, DeletedFlags, Delta, Expr, Part as AccPart, RawStages } from '../../../types'
import type { DeltaAccumulatorHKT, DeltaAccumulators } from '../../../types/accumulator'
import { mapExact } from '../../../utils/map-object'
import { $group_, $replaceWith_, $unwind_ } from '../../mongo-stages'
import { link } from '../../prefix'

export type WithItem<V, Grp> = Rec<'_id', Grp> & Rec<'item', O<V>>

export const subGroup = <T extends O, Grp, V extends O, GID extends string>(
  id: Expr<Grp, T>,
  args: DeltaAccumulators<T, V>,
  addGrp: <D extends Rec<'_id', Grp>>(src: ExprsExact<V, D>) => ExprsExact<RORec<GID, Grp> & V, D>,
): RawStages<unknown, Delta<T>, Rec<GID, Grp> & V> => {
  type Extra = ID & Deleted
  type Part = AccPart<T>
  type AfterKeep = Rec<'after', T> & Extra
  type BeforeKeep = Rec<'before', T> & Extra
  type GrpId = Rec<'_id', Grp>
  type WithGrpId = GrpId & V
  type HasItem = WithGrpId

  const part = filterDefined<Part, Delta<T>>(
    array<Part | null, Delta<T>>(
      ite<Part | null, null, T, RecHKT<'after', unknown, Extra>>(
        eqTyped<null, T, RecHKT<'after', unknown, Extra>>(root<After<T>>().of('after').expr(), nil),
        nil,
        field<Part, AfterKeep>({
          v: ['v', root<AfterKeep>().of('after').expr()],
          old: ['old', val(false)],
          deleted: [
            'deleted',
            root<AfterKeep>()
              .of<Deleted, 'deleted', null>('deleted')
              .of<DeletedFlags, 'after', null>('after')
              .expr(),
          ],
        }),
      ),
      ite<Part | null, null, T, RecHKT<'before', unknown, Extra>>(
        eqTyped<null, T, RecHKT<'before', unknown, Extra>>(
          root<Rec<'before', T | null> & Extra>().of('before').expr(),
          nil,
        ),
        nil,
        field<Part, BeforeKeep>({
          v: ['v', root<BeforeKeep>().of('before').expr()],
          old: ['old', val(true)],
          deleted: [
            'deleted',
            root<BeforeKeep>()
              .of<Deleted, 'deleted', null>('deleted')
              .of<DeletedFlags, 'before', null>('before')
              .expr(),
          ],
        }),
      ),
    ),
  )

  const replaceWith = <X extends O, A extends O>(expr: Expr<X, A>) => $replaceWith_(expr)

  return link<Delta<T>, unknown>()
    .with<unknown, Rec<'part', Arr<Part>>>(
      $replaceWith_(
        field({
          part: ['part', part],
        }),
      ),
    )
    .with<unknown, Rec<'part', Part>>($unwind_<O, 'part', Part>('part'))
    .with<unknown, Part>($replaceWith_(root<Rec<'part', Part>>().of('part').expr()))
    .with<unknown, WithGrpId>(
      $group_<V>()(
        sub(id, root<Part>().of('v')),
        mapExact<V, DeltaAccumulatorHKT<T>, AccumulatorHKT<Part>>(args, v => v.group),
      ),
    )
    .with<unknown, Rec<GID, Grp> & V>(
      replaceWith(
        field(
          addGrp<Rec<'_id', Grp> & HasItem>(
            mapExact<V, DeltaAccumulatorHKT<T>, ExprHKT<WithGrpId>>(args, (_, k) =>
              $getField(root<HasItem>().expr(), k),
            ),
          ),
        ),
      ),
    ).stages
}
