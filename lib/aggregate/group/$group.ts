import type { Arr, J, RORec, Rec, jsonItem } from '../../../types'
import { eq } from '../../expression/logic'
import { ctx, root } from '../../field'
import { $expr } from '../../predicate/$expr'
import type {
  Accumulators,
  AccumulatorsParam,
  Expr,
  RawStages,
  SimpleStream,
  TStages
} from '../../types'
import { $group_, $match_, $replaceWith_, $simpleLookup_, $unwind_ } from '../mongo-stages'
import { link } from '../prefix'

export const $group =
  <
    T extends J,
    ID extends jsonItem,
    Acc extends Accumulators<T, string & keyof Acc, RORec<string & keyof Acc, jsonItem>>,
  >(
    id: Expr<ID, T>,
    args: Acc,
  ) =>
  (stream: SimpleStream<T>): SimpleStream<Rec<'_id', ID> & AccumulatorsParam<T, Acc>> => {
    type WID = Rec<'_id', ID>
    type V = AccumulatorsParam<T, Acc>
    type VID = WID & V
    const stages: RawStages<WID, Rec<'item', Arr<VID>>, unknown, 1> = stream({
      lin: link<T, unknown, 1>().stages,
    }).stages(<S>({ coll, stages }: TStages<S, T, 1>) => {
      type Ctx = RORec<'id', ID>
      const pipeline = link<S, Ctx, 1>()
        .with(stages)
        .with($match_($expr(eq<ID, T, Ctx>(id)(ctx<ID>()('id').expr()))))
        .with($group_(id, args)).stages
      return $simpleLookup_<WID, VID, S, 'item', Ctx>({
        k: 'item',
        pipeline,
        vars: { id: root<WID>().of('_id').expr() },
        coll,
      })
    })
    type I1 = Rec<'item', Arr<VID>>
    type I2 = Rec<'item', VID>
    const unwind: RawStages<I1, I2> = $unwind_('item')
    const unwind1 = unwind as RawStages<I1, I2, unknown, 1>
    const transition = link<T, unknown, 1>()
      .with<VID>($group_(id, {}))
      .with(stages)
      .with(unwind1)
      .with($replaceWith_(root<I2>().of('item').expr()))

    return input => stream({ lin: transition.with(input.lin).stages })
  }
