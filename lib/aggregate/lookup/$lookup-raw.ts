import type { App, Arr, HKT, ID, J, Rec, doc } from '../../../types'
import { concat } from '../../expression/concat'
import { eq } from '../../expression/logic'
import { val } from '../../expression/val'
import { ctx, root, type Field } from '../../field'
import { $expr } from '../../predicate/$expr'
import type { Before, RawStages, TStages } from '../../types'
import { set, to, type Updater } from '../../update'
import { $match_, $replaceWith_, $set1, $simpleLookup1, $unwind1 } from '../mongo-stages'
import { link } from '../prefix'

type s = string

export const $lookupRaw =
  <
    LQ extends J,
    LE extends LQ & doc,
    RQ extends J,
    RE extends RQ & doc,
    BRB extends Before<RQ>,
    RS,
    S,
    As extends s,
  >(
    { field1, field2 }: { field1: Field<LQ, S>; field2: Field<RQ, S> },
    { coll, exec, input }: TStages<RS, Before<RQ>, BRB, Before<RE>>,
    k2: As,
    k: 'left' | 'right' | false,
  ) =>
  <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ): RawStages<App<F, LQ>, App<F, LE>, App<F, LE & Rec<As, RE> & ID>> => {
    type D = LE & Rec<As, RE>
    const left = root<D>().of('_id').expr()
    const right = root<D>().of<D, As>(k2).of<RE, '_id'>('_id').expr()
    const updateID: Updater<D, D, Omit<D, '_id'> & ID> = set({
      _id: to<D, string>(
        k === 'left' ? left : k === 'right' ? right : concat(left, val('.'), right),
      ),
    })

    return link<App<F, LE>>()
      .with<App<F, LE>, App<F, LE & Rec<As, Arr<RE>>>>(
        $simpleLookup1<LE, RE, RS, As, { readonly local: S }, unknown>({
          coll,
          k: k2,
          vars: { local: root<LE>().with(field1).expr() },
          pipeline: link<RS, { readonly local: S }>()
            .with<unknown, BRB>(input)
            .with<unknown, BRB>(
              $match_(
                $expr(
                  eq<S, BRB, { readonly local: S }>(ctx<S>()('local').expr())(
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
      .with<App<F, LE>, App<F, LE & Rec<As, RE> & ID>>(
        $set1<D, D, D & ID>(updateID as Updater<D, D, D & ID>)(f),
      ).stages
  }
