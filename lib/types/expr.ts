import type { App, HKT, JsonObj, Type, rawItem } from '../../types'
import type { Path } from '../field'

declare const Expr: unique symbol
declare const ExprRaw: unique symbol
export type ExprRaw<T, Doc, Ctx, V = rawItem> = V & {
  [Type]?(x: typeof ExprRaw, doc: Doc, ctx: Ctx): T
}
export type Expr<out T, in Doc, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  raw: <F extends HKT<unknown, JsonObj>>(f: Path<F>) => ExprRaw<T, App<F, Doc>, Ctx>
}

export type BoolExpr<in D1, in D2, in Ctx = unknown> = {
  [Type]?(x: typeof Expr): void
  raw: <F extends HKT<unknown, JsonObj>>(f: Path<F>) => ExprRaw<boolean, App<F, D1 | D2>, Ctx>
}
