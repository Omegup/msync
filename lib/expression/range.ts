import type { Expr } from '../types'

// exclusif
export const range = <D, C>(
  start: Expr<number, D, C>,
  end: Expr<number, D, C>,
  step?: Expr<number, D, C>,
): Expr<readonly number[], D, C> => ({
  raw: f => ({ $range: [start.raw(f), end.raw(f), step?.raw(f) ?? 1] }),
})

export const $map =
  <T, R>() =>
  <D, C>(
    expr: Expr<readonly T[], D, C>,
    map: (i: Expr<T, D, C>) => Expr<R, D, C>,
  ): Expr<readonly R[], D, C> => ({
    raw: f => ({
      $map: {
        input: expr.raw(f),
        as: 'item',
        in: map({ raw: () => '$$item' }).raw(f),
      },
    }),
  })
