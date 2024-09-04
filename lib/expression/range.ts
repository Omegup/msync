import type { RORec } from '../../types'
import { expr } from '../field'
import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'
import { ctx } from './val'

// exclusif
export const range = <D, C>(
  start: Expr<number, D, C>,
  end: Expr<number, D, C>,
  step?: Expr<number, D, C>,
) =>
  asExpr<readonly number[], D, C>({
    raw: f => asExprRaw({ $range: [start.raw(f), end.raw(f), step?.raw(f) ?? 1] }),
  })

export const $map =
  <T, R>() =>
  <D, C>(ex: Expr<readonly T[], D, C>, map: (i: Expr<T, D, RORec<'item', T>>) => Expr<R, D, C>) =>
    asExpr<readonly R[], D, C>({
      raw: f =>
        asExprRaw({
          $map: {
            input: ex.raw(f),
            as: 'item',
            in: map(expr<D, T, RORec<'item', T>>(() => ctx<T, 'item'>('item'))).raw(f),
          },
        }),
    })
