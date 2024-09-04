import type { JsonObj, O, RORec } from '../../types'
import type { Field } from '../field'
import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'

export const concat = <D, C>(...expr: Expr<string, D, C>[]) =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $concat: expr.map(e => e.raw(f)) }),
  })

export const str = <D, C>(expr: Expr<unknown, D, C>) =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $toString: expr.raw(f) }),
  })

export const fieldM = <
  M extends RORec<Dom, Ref>,
  T extends RORec<Ref, unknown>,
  D,
  Dom extends string = string & keyof M,
  Ref extends string = string & keyof T,
  C = unknown,
>(
  expr: {
    readonly [K in Ref]: Expr<T[K], D, C>
  },
  m: Pick<M, Dom>,
) =>
  asExpr<O<{ readonly [K in Dom]: T[M[K]] }>, D, C>({
    raw: <DeltaD extends JsonObj, Ctx>(f: Field<DeltaD, D, Ctx>) =>
      asExprRaw<O<{ readonly [K in Dom]: T[M[K]] }>, DeltaD, Ctx & C>(
        Object.fromEntries(
          Object.entries(m).map(<K extends Dom>([dom, ref]: readonly [K, M[K]]) => [
            dom,
            expr[ref].raw(f),
          ]),
        ),
      ),
  })
export const field = <T extends object, D, C = unknown>(expr: {
  readonly [K in string & keyof T]: Expr<T[K], D, C>
}) =>
  asExpr<O<T>, D, C>({
    raw: f => asExprRaw(Object.fromEntries(Object.entries(expr).map(([k, e]) => [k, e.raw(f)]))),
  })
