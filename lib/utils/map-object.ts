import type { RORec } from "../../types";

export const map = <T, K extends string & keyof T, V extends RORec<K, unknown>>(
  x: Pick<T, K>,
  f: <P extends K>(v: T[P], k: P) => V[P],
): V => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, f(v, k)]))
