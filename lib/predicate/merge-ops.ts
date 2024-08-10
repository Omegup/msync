import { jsonItem } from '../types/json';
import { Predicate, PredicateRaw } from '../types/predicate';

export const mergeOps: <T extends jsonItem>(
  ...ops: Predicate<T>[]
) => Predicate<T> = (...ops) => ({
  deepTest: (accessor) => (root) => ops.every((op) => op.deepTest(accessor)(root)),
  raw: ops.reduce<PredicateRaw>((acc, x) => ({ ...acc, ...x.raw }), {}),
});
