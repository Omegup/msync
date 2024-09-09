import type { Rec } from '../../types'

export const id = <T>(x: T) => x
export const defined = <T>(x: T | undefined | null): x is T => x != null
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {}
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const anoop = async () => {}

export const asRec = <K extends string, T>(x: Record<K, T>) => x as Rec<K, T>

export const map1 = <K extends string, Im>(k: K, to: Im) => ({ [k]: to }) as Record<K, Im>
