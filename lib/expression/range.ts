import type { RORec } from '../../types'
import { ctx } from '../field'
import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'

// exclusif
export const range = <D, C>(
  start: Expr<number, D, C>,
  end: Expr<number, D, C>,
  step?: Expr<number, D, C>,
) =>
  asExpr<readonly number[], D, C>({
    raw: f =>
      asExprRaw({ $range: [start.raw(f).get(), end.raw(f).get(), step?.raw(f).get() ?? 1] }),
  })

export const $map =
  <T, R>() =>
  <D, C>(ex: Expr<readonly T[], D, C>, map: (i: Expr<T, D, RORec<'item', T>>) => Expr<R, D, C>) =>
    asExpr<readonly R[], D, C>({
      raw: f =>
        asExprRaw({
          $map: {
            input: ex.raw(f).get(),
            as: 'item',
            in: map(ctx<T>()('item').expr()).raw(f).get(),
          },
        }),
    })
