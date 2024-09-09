import type { Arr, J, N, O, RORec, StrKey } from '../../types'
import { asExpr, asExprRaw } from '../expression/expr-base'
import type { Expr, ExprRaw, Query } from '../types'
import type { Predicate } from '../types/predicate'
import { id } from '../utils/json'

type Concat = <P, R, V, C, C2>(f1: Field<P, R, C>, f2: Field<R, V, C2>) => Field<P, V, C & C2>

export class Field<in R, out V, in C = unknown> {
  has<R extends J>(this: Field<R, V>, p: Predicate<V>): Query<R, C>
  has<R extends J, V>(this: Field<R, Arr<V>>, p: Predicate<V>): Query<R, C>
  has<R extends J>(this: Field<R, V | Arr<V>>, p: Predicate<V | Arr<V>>): Query<R, C> {
    return {
      raw: f => ({ [f.with(this).str()]: p.raw }),
      expr: p.expr(this),
    }
  }
  private constructor(
    private field: string,
    private raw: (x: string) => string,
    private concat: Concat,
  ) {}
  static root = <T extends J>() => {
    const concat: Concat = (f1, f2) =>
      new Field([f1.field, f2.field].filter(id).join('.'), f1.raw, f1.concat)
    return new Field<T, T>('', s => (s ? `$${s}` : '$$ROOT'), concat)
  }
  static ctx =
    <T>() =>
    <K extends string>(k: K) => {
      const concat: Concat = (_, f2) => new Field(f2.field, f2.raw, f2.concat)
      return new Field<unknown, T, RORec<K, T>>(k, s => `$$${s}`, concat)
    }
  public of<V, K extends keyof V, _ extends 0>(
    this: Field<R, Arr<V>, C>,
    k: K,
  ): Field<R, Arr<V[K]>, C>
  public of<V, K extends keyof V, _ extends 1>(
    this: Field<R, Arr<V> | N>,
    k: K,
  ): Field<R, Arr<V[K]> | N, C>
  public of<V, K extends keyof V, _ extends 2>(this: Field<R, O<V>, C>, k: K): Field<R, V[K], C>
  public of<V, K extends keyof V, _ extends 3>(
    this: Field<R, O<V> | N, C>,
    k: K,
  ): Field<R, V[K] | N, C>

  public of<K extends StrKey<V>>(k: K): Field<R, V[K] | Arr<V[K]> | N, C> {
    return new Field([this.field, k].filter(id).join('.'), this.raw, this.concat)
  }

  public with<V, W, _ extends 4, C2 = unknown>(
    this: Field<R, O<V>, C>,
    k: Field<O<V>, W, C2>,
  ): Field<R, W, C & C2>
  public with<V, W, _ extends 5, C2 = unknown>(
    this: Field<R, O<V> | N, C>,
    k: Field<O<V>, W, C2>,
  ): Field<R, W | N, C & C2>
  public with<V, W, _ extends 6, C2 = unknown>(
    this: Field<R, O<V>, C>,
    k: Field<O<V>, W, C2>,
  ): Field<R, W, C & C2>
  public with<V, W, _ extends 7, C2 = unknown>(
    this: Field<R, Arr<V> | N, C>,
    k: Field<O<V>, Arr<W> | O<W>, C2>,
  ): Field<R, Arr<W> | N, C & C2>
  public with<W>(k: Field<O<V>, W, C>): Field<R, W, C> {
    return k.concat<R, O<V>, W, C, C>(this as Field<R, O<V>, C>, k)
  }

  str(this: Field<R, V>) {
    return this.field
  }
  private exprRaw(): ExprRaw<V, R, C> {
    return asExprRaw(this.raw(this.field))
  }
  expr<R, V, C = unknown>(this: Field<R, V, C>): Expr<V, R, C>
  expr<R extends J, V, C = unknown>(this: Field<R, V, C>): Expr<V, R, C> {
    return asExpr<V, R, C>({
      raw: f => f.with<R, V, 4, C>(this).exprRaw(),
    })
  }
}

export type Path<R extends J, V, Ctx = unknown> = Field<R, V, Ctx>
export const { root, ctx } = Field

export type JField<T extends J, S> = Field<T, S> | Field<T, Arr<S>>
