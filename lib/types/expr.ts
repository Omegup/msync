import type { Type, rawItem } from '../../types'

declare const Expr: unique symbol
declare const ExprRaw: unique symbol
export type ExprRaw<T, Doc, Ctx, V = rawItem> = V & {
  [Type]?(x: typeof ExprRaw, doc: Doc, ctx: Ctx): T
}
export type Expr<out T, in Doc, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  raw: () => ExprRaw<T, Doc, Ctx>
}

export type BoolExpr<in D1, in D2, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  raw: () => ExprRaw<boolean, D1 | D2, Ctx>
}
