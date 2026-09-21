import type { Arr, RORec } from '../../types'
import { ctx, Field } from '../field'
import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'

// exclusif
export const range = <D, C>(
  start: Expr<number, D, C>,
  end: Expr<number, D, C>,
  step?: Expr<number, D, C>,
) =>
  asExpr<Arr<number>, D, C>({
    raw: f =>
      asExprRaw({ $range: [start.raw(f).get(), end.raw(f).get(), step?.raw(f).get() ?? 1] }),
  })

export const $map0 = <K extends string, T, R, D, C>({
  as,
  expr,
  input,
}: {
  input: Expr<Arr<T>, D, C>
  as: K
  expr: Expr<R, D, RORec<K, T> & C>
}) =>
  asExpr<Arr<R>, D, C>({
    raw: f =>
      asExprRaw({
        $map: {
          input: input.raw(f).get(),
          as,
          in: expr.raw(f).get(),
        },
      }),
  })
export const $map1 = <T, R, D, C>(
  ex: Expr<Arr<T>, D, C>,
  map: (i: Field<unknown, T, RORec<'item', T>>) => Expr<R, D, RORec<'item', T> & C>,
) => $map0({ input: ex, as: 'item', expr: map(ctx<T>()('item')) })
export const $map = <T, R, D, C = unknown>(
  ex: Expr<Arr<T>, D, C>,
  map: (i: Expr<T, D, RORec<'item', T>>) => Expr<R, D, RORec<'item', T> & C>,
) => $map1(ex, i => map(i.expr()))
