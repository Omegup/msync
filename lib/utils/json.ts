import type { AsLiteral, Rec } from '../../types'

export const safeNarrow = <V>() => {
  return <T>(x: T & V) => x
}
export const id = <T>(x: T) => x
export const defined = <T>(x: T | undefined | null): x is T => x != null
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {}
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const anoop = async () => {}

export const asRec = <K extends string, T>(x: Record<K, T>) => x as Rec<K, T>

export const map1 = <K extends string, Im>(k: AsLiteral<K>, to: Im) => {
  const k2: K = k
  return { [k]: [k2, to] } as { readonly [P in K]: [P, Im] } & { readonly [_: string]: [K, Im] }
}
