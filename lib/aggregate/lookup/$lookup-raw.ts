import type { App, Arr, AsLiteral, HKT, ID, N, O, Rec, RORec } from '../../../types'
import { concat } from '../../expression/concat'
import { eq } from '../../expression/logic'
import { val } from '../../expression/val'
import { ctx, root, type Field } from '../../field'
import { $expr } from '../../predicate/$expr'
import type { Before, RawStages, TStages } from '../../types'
import { set, to } from '../../update'
import { map1 } from '../../utils/json'
import { $match_, $replaceWith_, $set1, $simpleLookup1, $unwind1 } from '../mongo-stages'
import { link } from '../prefix'

type s = string

export const $lookupRaw =
  <
    LQ extends O,
    LE extends LQ & ID,
    RQ extends O,
    RE extends RQ & ID,
    BRB extends Before<RQ>,
    RS,
    S,
    As extends s,
  >(
    { field1, field2 }: { field1: Field<LQ, S>; field2: Field<RQ, S> },
    { coll, exec, input }: TStages<RS, Before<RQ>, BRB, Before<RE>>,
    k2: AsLiteral<As>,
    k: 'left' | 'right' | false,
  ) =>
  <F extends HKT<O, O>>(
    f: <T extends O>() => Field<App<F, T>, T>,
  ): RawStages<App<F, LQ>, App<F, LE>, App<F, LE & Rec<As, RE> & ID>> => {
    type D = LE & Rec<As, RE>
    const left = root<D>().of('_id').expr()
    const right = root<D>().of<D, As>(k2).of<RE, '_id'>('_id').expr()

    const idVal = to(k === 'left' ? left : k === 'right' ? right : concat(left, val('.'), right))

    return link<App<F, LE>>()
      .with<App<F, LE>, App<F, LE & Rec<As, Arr<RE>>>>(
        $simpleLookup1<LE, RE, RS, As, { readonly local: S }, unknown>({
          coll,
          k: k2,
          vars: map1('local', root<LE>().with(field1).expr()),
          pipeline: link<RS, { readonly local: S }>()
            .with<unknown, BRB>(input)
            .with<unknown, BRB>(
              $match_(
                $expr(
                  eq<S | N, BRB, { readonly local: S }>(ctx<S>()('local').expr())(
                    root<BRB>().of('before').with(field2).expr(),
                  ),
                ),
              ),
            )
            .with<unknown, Before<RE>>(exec)
            .with<unknown, RE>($replaceWith_(root<Before<RE>>().of('before').expr())).stages,
        })(f),
      )
      .with<App<F, LE>, App<F, D>>($unwind1<LE, As, RE>(k2)(f))
      .with<App<F, LE>, App<F, D>>(
        k === 'left'
          ? link<App<F, D>>().stages
          : $set1(set<RORec<'_id', string>>()<D, D>({ _id: ['_id', idVal] }))(f),
      ).stages
  }
