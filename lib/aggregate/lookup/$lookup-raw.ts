import type { App, Arr, AsLiteral, HKT, ID, N, O, Rec, RORec } from '../../../types';
import { root, type Field } from '../../field';
import type { Before, RawStages, TStages, UBefore } from '../../types';
import { set, to } from '../../update';
import { $replaceWith_, $set1, $simpleLookup1, $unwind1 } from '../mongo-stages';
import { link } from '../prefix';

type s = string

export const $lookupRaw =
  <
    LQ extends O,
    LE extends LQ & ID,
    RQ extends O,
    RE extends RQ & ID,
    BRB extends Before<RQ>,
    RS extends UBefore<RQ>,
    S,
    As extends s,
    Null extends null = never,
  >(
    { field1, field2 }: { field1: Field<LQ, S | Arr<S>>; field2: Field<RQ, S | Arr<S>> },
    { coll, exec, input }: TStages<RS, Before<RQ>, BRB, Before<RE>>,
    k2: AsLiteral<As>,
    k: 'left',
    includeNull?: Null,
  ) =>
  <F extends HKT<O, O>>(
    f: <T extends O>() => Field<App<F, T>, T>,
  ): RawStages<App<F, LQ>, App<F, LE>, App<F, LE & Rec<As, RE> & ID>> => {
    type D = LE & Rec<As, RE | Null>
    const left = root<D>().of('_id').expr()

    const idVal = to(left)

    return link<App<F, LE>>()
      .with<App<F, LE>, App<F, LE & Rec<As, Arr<RE>>>>(
        $simpleLookup1<LE, RE, RS, As, unknown, unknown, S | N>({
          coll,
          k: k2,
          fields: { local: field1, foreign: root<UBefore<RQ>>().of('before').with(field2) },
          vars: {},
          pipeline: link<RS>()
            .with<unknown, BRB>(input)
            .with<unknown, Before<RE>>(exec)
            .with<unknown, RE>($replaceWith_(root<Before<RE>>().of('before').expr())).stages,
        })(f),
      )
      .with<App<F, LE>, App<F, D>>($unwind1<LE, As, RE, Null>(k2, includeNull)(f))
      .with<App<F, LE>, App<F, D>>(
        k === 'left'
          ? link<App<F, D>>().stages
          : $set1(set<RORec<'_id', string>>()<D, D>({ _id: ['_id', idVal] }))(f),
      ).stages
  }
