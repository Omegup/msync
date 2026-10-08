import type {
  App,
  ConstHKT,
  HKT,
  I,
  IdHKT,
  N,
  O,
  Omit,
  RawObj,
  RORec,
  StrKey,
  U,
  Undef,
  rawItem,
} from '../../types'
import type { Field } from '../field'
import type { Expr } from '../types'
import { safeNarrow } from '../utils/json'
import {
  mapExactToObject,
  spread,
  type Exact,
  type ExactPart,
  type MapO,
  type MergeHKT,
  spread0,
} from '../utils/map-object'
import { asExpr, asExprRaw } from './expr-base'
import { val } from './val'

export const concat: {
  <D, C>(...expr: Expr<string, D, C>[]): Expr<string, D, C>
  <D, C>(...expr: Expr<string | N, D, C>[]): Expr<string | N, D, C>
} = <D, C>(...expr: Expr<string | N, D, C>[]) =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $concat: expr.map(e => e.raw(f).get()) }),
  })

export const $substr = <D, C>(
  expr: Expr<string, D, C>,
  start: Expr<number, D, C>,
  length: Expr<number, D, C>,
) =>
  asExpr<string, D, C>({
    raw: f =>
      asExprRaw({
        $substrCP: [expr.raw(f).get(), start.raw(f).get(), length.raw(f).get()],
      }),
  })
export const padLeft = <D, C>(expr: Expr<string, D, C>, pad: string) =>
  asExpr<string, D, C>({
    raw: f =>
      asExprRaw({
        $let: {
          vars: {
            x: {
              $concat: [{ $literal: pad }, expr.raw(f).get()],
            },
          },
          in: { $substrCP: ['$$x', { $subtract: [{ $strLenCP: '$$x' }, pad.length] }, pad.length] },
        },
      }),
  })
export const regex = <D, C>(
  expr: Expr<string, D, C>,
  regex: Expr<string, D, C>,
  options?: Expr<string, D, C>,
) =>
  asExpr<boolean, D, C>({
    raw: f =>
      asExprRaw({
        $regexMatch: {
          input: expr.raw(f).get(),
          regex: regex.raw(f).get(),
          options: options?.raw(f).get(),
        },
      }),
  })
export const str = <D, C>(expr: Expr<unknown, D, C>) =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $toString: expr.raw(f).get() }),
  })
export const toInt = <D, C>(expr: Expr<unknown, D, C>) =>
  asExpr<number, D, C>({
    raw: f => asExprRaw({ $toInt: expr.raw(f).get() }),
  })

export const fieldM = <
  M extends RORec<Dom, Ref>,
  T extends RORec<Ref, unknown>,
  D,
  Dom extends string = StrKey<M>,
  Ref extends string = StrKey<T>,
  C = unknown,
>(
  expr: { readonly [K in Ref]: Expr<T[K], D, C> },
  m: Pick<M, Dom>,
) =>
  asExpr<O<{ readonly [K in Dom]: T[M[K]] }>, D, C>({
    raw: <DeltaD extends O, I extends U, Ctx>(f: Field<DeltaD, D | Undef<I>, Ctx>) =>
      asExprRaw<O<{ readonly [K in Dom]: T[M[K]] }>, DeltaD, C>(
        Object.fromEntries(
          Object.entries(m).flatMap(<K extends Dom>([dom, ref]: readonly [K, M[K]]) =>
            expr[ref] ? [[dom, expr[ref].raw(f).get()]] : [],
          ),
        ),
      ),
  })

export type Exprs<out T, in D, in C = unknown> = {
  readonly [K in StrKey<T>]: Expr<T[K], D, C>
}
type MergeExactArgs<T1, T2, F extends HKT<T1[StrKey<T1>] | T2[StrKey<T2>]>> = readonly [
  Exact<Omit<T1, keyof T2>, F>,
  Exact<T2, F>,
]
export const mergeExact = <T1, T2, F extends HKT<T1[StrKey<T1>] | T2[StrKey<T2>]>, EK extends symbol = never, EE = unknown>(
  ...[exprsExact1, exprsExact2]: MergeExactArgs<T1, T2, F>
): Exact<T2 & Omit<T1, keyof T2> & Record<EK, EE>, F> =>
  spread<T1, T2, F, EK, EE, keyof T2>(exprsExact1, exprsExact2)

export type MergeMapOArgs<
  T1,
  T2,
  F1 extends HKT<StrKey<Omit<T1, StrKey<T2>>>>,
  F2 extends HKT<StrKey<T2>>,
> = readonly [MapO<Omit<T1, StrKey<T2>>, F1>, MapO<T2, F2>]
export const mergeExact0 = <
  T1,
  T2,
  F1 extends HKT<StrKey<Omit<T1, StrKey<T2>>>>,
  F2 extends HKT<StrKey<T2>>,
  E = unknown,
>(
  ...[exprsExact1, exprsExact2]: MergeMapOArgs<T1, T2, F1, F2>
): MapO<
  T2 & Omit<T1, StrKey<T2>> & Pick<E, symbol & keyof E>,
  MergeHKT<T1, T2, F1, F2, StrKey<T2>>
> => spread0<T1, T2, F1, F2, E, StrKey<T2>>(exprsExact1, exprsExact2)

export const mergeExpr = <T1, T2, D, C = unknown, EK extends symbol = never, EE = unknown>(
  ...exprs: MergeExactArgs<T1, T2, ExprHKT<D, C>>
): ExprsExact<T2 & Omit<T1, keyof T2> & Record<EK, EE>, D, C> =>
  mergeExact<T1, T2, ExprHKT<D, C>, EK, EE>(...exprs)

export type ExprsPart<T, D, C> = ExactPart<T, ExprHKT<D, C>>
export interface ExprHKT<D, C = unknown, F extends HKT = IdHKT> extends HKT<unknown> {
  readonly out: Expr<App<F, I<unknown, this>>, D, C>
}

export type ExprsExact<T, D, C = unknown, F extends HKT = IdHKT> = Exact<T, ExprHKT<D, C, F>>
export interface ExprsExactHKT<E, D, C = unknown, F extends HKT = IdHKT> extends HKT {
  readonly out: ExprsExact<E & I<unknown, this>, D, C, F>
}

export const fieldF =
  <F extends HKT>() =>
  <T extends object, D, C = unknown>(exprs: ExprsExact<T, D, C, F>) =>
    Object.keys(exprs).length
      ? asExpr<O<{ [K in keyof T]: App<F, T[K]> }>, D, C>({
          raw: f =>
            asExprRaw(
              mapExactToObject<T, ExprHKT<D, C>, ConstHKT<rawItem>>(exprs, e => e.raw(f).get()),
            ),
        })
      : asExpr<O<{ [K in keyof T]: App<F, T[K]> }>, D, C>(
          val(safeNarrow<RawObj>()({})),
        )
export const field: <T extends object, D, C = unknown>(
  exprs: ExprsExact<T, D, C>,
) => Expr<O<T>, D, C> = fieldF<IdHKT>()
