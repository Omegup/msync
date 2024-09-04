import type { rawItem } from '../../types'
import type { BoolExpr, Expr, ExprRaw } from '../types'

export const asExprRaw = <T, Doc, Ctx>(raw: rawItem) => raw as ExprRaw<T, Doc, Ctx>
export const asExpr = <T, Doc, Ctx = unknown>(r: Pick<Expr<T, Doc, Ctx>, 'raw'>) =>
  r as Expr<T, Doc, Ctx>

export const asBoolExpr = <D1, D2, Ctx = unknown>(r: Pick<BoolExpr<D1, D2, Ctx>, 'raw'>) =>
  r as BoolExpr<D1, D2, Ctx>
