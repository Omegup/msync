import type { App, Arr, AsLiteral, HKT, ID, N, O, Rec, RORec, notArr } from '../../../types'
import { $ifNull, concat, val } from '../../expression'
import { root, type Field } from '../../field'
import type { Before, RawStages, TStages, UBefore } from '../../types'
import { set, to } from '../../update'
import { $replaceWith_, $set1, $simpleLookup1, $unwind1 } from '../mongo-stages'
import { link } from '../prefix'
import { type JoinId } from '../unwind'

type s = string

export const $lookupRaw =
  <
    LQ extends O,
    LE extends LQ & ID,
    RQ extends O,
    RE extends RQ & ID,
    BRB extends Before<RQ>,
    RS extends UBefore<RQ>,
    S extends notArr,
    As extends s,
    Null extends null = never,
  >(
    { field1, field2 }: { field1: Field<LQ, S | Arr<S>>; field2: Field<RQ, S | Arr<S>> },
    { coll, exec, input }: TStages<RS, Before<RQ>, BRB, Before<RE>>,
    k2: AsLiteral<As>,
    k: JoinId<'left', 'right'>,
    includeNull?: Null,
  ) =>
  <F extends HKT<O, O>>(
    f: <T extends O>() => Field<App<F, T>, T>,
  ): RawStages<App<F, LQ>, App<F, LE>, App<F, LE & Rec<As, RE | Null> & ID>> => {
    type D = LE & Rec<As, RE | Null>
    const left = root<D>().of('_id').expr()
    const right = root<D>().of<D, As>(k2).of<RE, '_id', Null>('_id').expr()
    const keepLeft = k === 'left'
    const composedId =
      typeof k === 'string' ? right : concat(left, val<s>(k[1]), right)
    return link<App<F, LE>>()
      .with<App<F, LE>, App<F, LE & Rec<As, Arr<RE>>>>(
        $simpleLookup1<LE, RE, RS, As, unknown, unknown, S | N>({
          coll,
          k: k2,
          fields: {
            local: field1,
            foreign: root<UBefore<RQ>>().of('before').with(field2),
          },
          vars: {},
          pipeline: link<RS>()
            .with<unknown, BRB>(input)
            .with<unknown, Before<RE>>(exec)
            .with<unknown, RE>($replaceWith_(root<Before<RE>>().of('before').expr())).stages,
        })(f),
      )
      .with<App<F, LE>, App<F, D>>($unwind1<LE, As, RE, Null>(k2, includeNull)(f))
      .with<App<F, LE>, App<F, D>>(
        keepLeft
          ? link<App<F, D>>().stages
          : $set1(
              set<RORec<'_id', s>>()<D, D>({
                _id: ['_id', to($ifNull(composedId, left))],
              }),
            )(f),
      ).stages
  }
