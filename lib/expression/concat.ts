import type { J, O, RORec, StrKey, rawItem } from '../../types'
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

export const fieldM = <
  M extends RORec<Dom, Ref>,
  T extends RORec<Ref, unknown>,
  D,
  Dom extends string = StrKey<M>,
  Ref extends string = StrKey<T>,
  C = unknown,
>(
  expr: {
    readonly [K in Ref]: Expr<T[K], D, C>
  },
  m: Pick<M, Dom>,
) =>
  asExpr<O<{ readonly [K in Dom]: T[M[K]] }>, D, C>({
    raw: <DeltaD extends J, Ctx>(f: Field<DeltaD, D, Ctx>) =>
      asExprRaw<O<{ readonly [K in Dom]: T[M[K]] }>, DeltaD, Ctx & C>(
        Object.fromEntries(
          Object.entries(m).map(<K extends Dom>([dom, ref]: readonly [K, M[K]]) => [
            dom,
            expr[ref].raw(f),
          ]),
        ),
      ),
  })
type Exprs<T, D, C> = {
  readonly [K in StrKey<T>]: Expr<T[K], D, C>
}
export const field = <T extends object, D, C = unknown>(expr: Exprs<T, D, C>) =>
  asExpr<O<T>, D, C>({
    raw: f =>
      asExprRaw(
        map<StrKey<T>, Exprs<T, D, C>, Record<StrKey<T>, rawItem>>(expr, e =>
          e.raw(f).get(),
        ),
      ),
  })
