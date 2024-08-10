import type { DeepGet, Items } from "../../types";

export const asItems = <F>(x: F): Items<F>[] =>
  Array.isArray(x) ? [x, ...x] : [x];

const has = <T extends object, K extends string>(
  x: T,
  k: K
): x is T & Record<K, DeepGet<T, K>> => k in x;

export function deepGet<V, K extends string>([x]: V[], k: K): DeepGet<V, K>[] {
  if (!Array.isArray(x))
    return x && typeof x === 'object' && has(x, k) ? [x[k]] : [];
  return [x.flatMap(x=>deepGet([x], k)) as unknown as DeepGet<V, K>]
}

export const id = <T>(x: T) => x;
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const anoop = async () => {};

// const ze = get<{a:1}[], 'a'>()
export class Field {
  constructor(readonly field: string) {}
  add = (k: keyof never) =>
    new Field(this.field ? `${this.field}.${k.toString()}` : k.toString());
}
