import { json, Query } from '../types';

type Reducer = <T>(x: T[], f: (x: T) => boolean) => boolean;

export const combine =
  (op: string, reducer: Reducer) =>
  <T extends json>(...args: Query<T>[]): Query<T> => ({
    raw: (prefix) => ({ [op]: args.map((x) => x.raw(prefix)) }),
    test: (x) => reducer(args, (o) => o.test(x)),
  });

export const $and = combine('$and', (x, f) => x.every(f));
export const $nor = combine('$nor', (x, f) => !x.some(f));
export const $or = combine('$or', (x, f) => x.some(f));
export const sub = <
  T extends Record<K, json | null>,
  K extends string & keyof T
>(
  { raw, test }: Query<Exclude<T[K], null>>,
  k: K
): Query<T> => ({
  raw: (prefix) => raw((field) => prefix(`${k}.${field}`)),
  test: (x) => x[k] !== null && test(x[k] as Exclude<T[K], null>),
});
