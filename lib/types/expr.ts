import type { JsonObj, Type, rawItem } from '../../types'
import type { Field } from '../field'

declare const Expr: unique symbol
declare const ExprRaw: unique symbol
export type ExprRaw<T, Doc, Ctx, V = rawItem> = V & {
  [Type]?(x: typeof ExprRaw, doc: Doc, ctx: Ctx): T
}
export type Expr<out T, in Doc, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  raw: <DeltaD extends JsonObj>(f: Field<DeltaD, Doc>) => ExprRaw<T, DeltaD, Ctx>
}

export type BoolExpr<in D1, in D2, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  raw: <DeltaD extends JsonObj>(f: Field<DeltaD, D1 | D2>) => ExprRaw<boolean, DeltaD, Ctx>
}
