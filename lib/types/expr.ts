import type { Type } from '../../types'
import type { jsonItem } from '../../types'

declare const Expr: unique symbol
declare const ExprRaw: unique symbol
export type ExprRaw<T, Doc, Ctx> = jsonItem & {
  [Type]?(x: typeof ExprRaw): void
  eval?(doc: Doc, ctx: Ctx): T
}
export type Expr<T, Doc, Ctx> = {
  [Type]?(x: typeof Expr): void
  raw: () => ExprRaw<T, Doc, Ctx>
}

export type BoolExpr<D1, D2, Ctx> = {
  [Type]?(x: typeof Expr): void
  raw: () => ExprRaw<boolean, D1 | D2, Ctx>
}
