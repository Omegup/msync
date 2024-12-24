import type { O, Type, U, Undef, rawItem } from '../../types'
import type { Field } from '../field'

declare const Expr: unique symbol
declare const BoolExpr: unique symbol
declare const ExprRaw: unique symbol
export type ExprRaw<out T, in Doc, in Ctx = unknown> = {
  [Type]?(x: typeof ExprRaw): void
  [ExprRaw]?(doc: Doc, ctx: Ctx): T
  get: () => rawItem
}
export type Expr<out T, in Doc, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  [Expr]?(doc: Doc, ctx: Ctx): T
  raw: {
    <DeltaD extends O, I extends U, C = unknown>(f: Field<DeltaD, Doc | Undef<I>, C>): ExprRaw<T | I, DeltaD, Ctx & C>
  }
}

export type BoolExpr<in D1, in D2, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  [Expr](doc: D1, ctx: Ctx): true
  [Expr](doc: D2, ctx: Ctx): false
  raw: {
    <DeltaD extends O, I extends U, C = unknown>(f: Field<DeltaD, D1 | D2 | Undef<I>, C>): ExprRaw<boolean, DeltaD, Ctx & C>
    <DeltaD extends O, I extends U, C = unknown>(f: Field<DeltaD, D1 | Undef<I>, C>): ExprRaw<true, DeltaD, Ctx & C>
    <DeltaD extends O, I extends U, C = unknown>(f: Field<DeltaD, D2 | Undef<I>, C>): ExprRaw<false, DeltaD, Ctx & C>
  }
}
