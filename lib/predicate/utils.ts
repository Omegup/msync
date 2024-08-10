import eq from 'fast-deep-equal';

export const equal = (a: unknown, b: unknown) =>
  (a == null && b == null) || eq(a, b);

