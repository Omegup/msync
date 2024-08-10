import { Expr } from "../types";

// exclusif
export const range = <D, C>(
  start: Expr<number, D, C>,
  end: Expr<number, D, C>,
  step?: Expr<number, D, C>
): Expr<readonly number[], D, C> => ({
  raw: () => ({ $range: [start.raw(), end.raw(), step?.raw() ?? 1] }),
  eval: (d, c) => {
    const [s, e, sp] = [start, end, step].map((v) => v?.eval(d, c) ?? 1);
    return Array((e - s) / sp)
      .fill(0)
      .map((_, x) => x * sp + s);
  },
});

export const $map = <T, R>()=><D, C>(
  expr: Expr<readonly T[], D, C>,
  map: (i: Expr<T, D, C>) => Expr<R, D, C>
): Expr<readonly R[], D, C> => ({
  raw: () => ({
    $map: {
      input: expr.raw(),
      as: "item",
      in: map({ raw: () => "$$item", eval: null! }).raw(),
    },
  }),
  eval: (d, c) =>
    expr
      .eval(d, c)
      .map((item) => map({ raw: null!, eval: () => item }).eval(d, c)),
});
