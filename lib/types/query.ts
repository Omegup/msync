import type { Type, JsonObj, jsonItem } from '../../types'

declare const Query: unique symbol
declare const QueryRaw: unique symbol

export type QueryRaw = JsonObj & {
  [Type]?(x: typeof QueryRaw): void
}

export type Query<in T extends jsonItem> = {
  [Type]?(x: typeof Query, y: T): void
  raw: (prefix: (k: string) => string) => QueryRaw
}
