export const map = <K extends string, T extends Record<K, unknown>, V extends Record<K, unknown>>(
  x: Pick<T, K>,
  f: <P extends K>(v: T[P], k: P) => V[P],
): V => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, f(v, k)]))
