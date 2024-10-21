import type { J, O, RORec, StrKey, U, Undef, rawItem } from '../../types'
import type { Field } from '../field'
import type { Expr } from '../types'
import { map } from '../utils/map-object'
import { asExpr, asExprRaw } from './expr-base'

export const concat = <D, C>(...expr: Expr<string, D, C>[]) =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $concat: expr.map(e => e.raw(f).get()) }),
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
    raw: <DeltaD extends J, I extends U, Ctx>(f: Field<DeltaD, D | Undef<I>, Ctx>) =>
      asExprRaw<O<{ readonly [K in Dom]: T[M[K]] }>, DeltaD, Ctx & C>(
        Object.fromEntries(
          Object.entries(m).map(<K extends Dom>([dom, ref]: readonly [K, M[K]]) => [
            dom,
            expr[ref].raw(f).get(),
          ]),
        ),
      ),
  })

export type Exprs<out T, in D, in C = unknown> = {
  readonly [K in StrKey<T>]: Expr<T[K], D, C>
}

export const mergeExprs = <T, V, D, C = unknown>(exprs: Exprs<T, D, C>, exprs2: Exprs<V, D, C>) =>
  ({ ...exprs, ...exprs2 }) as Exprs<T & V, D, C>
export const field = <T extends object, D, C = unknown>(expr: Exprs<T, D, C>) =>
  asExpr<O<T>, D, C>({
    raw: f =>
      asExprRaw(
        map<Exprs<T, D, C>, StrKey<T>, Record<StrKey<T>, rawItem>>(expr, e => e.raw(f).get()),
      ),
  })
