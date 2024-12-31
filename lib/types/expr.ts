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
    <DeltaD extends O, I extends U>(f: Field<DeltaD, Doc | Undef<I>>): ExprRaw<T | I, DeltaD, Ctx>
  }
}

export type BoolExpr<in D1, in D2, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  [Expr](doc: D1, ctx: Ctx): true
  [Expr](doc: D2, ctx: Ctx): false
  raw: {
    <DeltaD extends O, I extends U>(f: Field<DeltaD, D1 | D2 | Undef<I>>): ExprRaw<boolean, DeltaD, Ctx>
    <DeltaD extends O, I extends U>(f: Field<DeltaD, D1 | Undef<I>>): ExprRaw<true, DeltaD, Ctx>
    <DeltaD extends O, I extends U>(f: Field<DeltaD, D2 | Undef<I>>): ExprRaw<false, DeltaD, Ctx>
  }
}
