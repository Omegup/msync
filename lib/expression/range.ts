import type { Expr } from '../types'

// exclusif
export const range = <D, C>(
  start: Expr<number, D, C>,
  end: Expr<number, D, C>,
  step?: Expr<number, D, C>,
): Expr<readonly number[], D, C> => ({
  raw: () => ({ $range: [start.raw(), end.raw(), step?.raw() ?? 1] }),
})

export const $map =
  <T, R>() =>
  <D, C>(
    expr: Expr<readonly T[], D, C>,
    map: (i: Expr<T, D, C>) => Expr<R, D, C>,
  ): Expr<readonly R[], D, C> => ({
    raw: () => ({
      $map: {
        input: expr.raw(),
        as: 'item',
        in: map({ raw: () => '$$item' }).raw(),
      },
    }),
  })
