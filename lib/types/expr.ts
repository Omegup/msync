import type { JsonObj, Type, rawItem } from '../../types'
import type { Field } from '../field'

declare const Expr: unique symbol
declare const BoolExpr: unique symbol
declare const ExprRaw: unique symbol
export type ExprRaw<out T, in Doc, in Ctx = unknown> = {
  [Type]?(x: typeof ExprRaw): void
  [ExprRaw](doc: Doc, ctx: Ctx): T
  get: () => rawItem
}
export type Expr<out T, in Doc, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  [Expr](doc: Doc, ctx: Ctx): T
  raw: { <DeltaD extends JsonObj, C = unknown>(f: Field<DeltaD, Doc, C>): ExprRaw<T, DeltaD, Ctx & C> }
}

export type BoolExpr<in D1, in D2, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  [Expr](doc: D1, ctx: Ctx): true
  [Expr](doc: D2, ctx: Ctx): false
  raw: {
    <DeltaD extends JsonObj, C = unknown>(f: Field<DeltaD, D1 | D2, C>): ExprRaw<boolean, DeltaD, Ctx & C>
    <DeltaD extends JsonObj, C = unknown>(f: Field<DeltaD, D1, C>): ExprRaw<true, DeltaD, Ctx & C>
    <DeltaD extends JsonObj, C = unknown>(f: Field<DeltaD, D2, C>): ExprRaw<false, DeltaD, Ctx & C>
  }
}
