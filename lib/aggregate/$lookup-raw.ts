import type { Rec, doc } from '../../types'
import { field } from '../expression/concat'
import { eq } from '../expression/logic'
import { ctx } from '../expression/val'
import { Field, root } from '../field'
import { $expr } from '../predicate/$expr'
import type { Expr, TStages } from '../types'
import { $match_, $replaceWith_, $simpleLookup_, $unwind_ } from './$match-raw'
import { concatStages, link } from './prefix'

type s = string
export const $lookupRaw = <T extends doc, U extends doc, R, S, K1 extends s, K2 extends s>(
  { field2, field1 }: { field2: Field<U, S>; field1: Field<T, S> },
  { stages, coll }: TStages<R, U>,
  k1: K1,
  k2: K2,
) =>
  link<T>()
    .with(
      $replaceWith_<T, Rec<K1, T>>(
        field(Object.fromEntries<Record<K1, Expr<T, T>>>([[k1, root()]])),
      ),
    )
    .with(
      $simpleLookup_<Rec<K1, T>, U, R, K2, { readonly local: S }, unknown>({
        coll,
        k: k2,
        vars: { local: root<Rec<K1, T>>().of(k1).of(field1) },
        pipeline: concatStages(
          stages,
          $match_($expr(eq<S, U, { readonly local: S }>(ctx('local'))(field2))),
        ),
      }),
    )
    .with($unwind_<Rec<K1, T>, K2, U>(k2)).stages
