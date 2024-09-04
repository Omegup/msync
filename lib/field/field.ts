import type { Arr, JsonObj, N, O, RORec } from '../../types'
import { asExpr, asExprRaw } from '../expression/expr-base'
import type { ExprRaw, Query } from '../types'
import type { Predicate } from '../types/predicate'
import { id } from '../utils/json'

export class Field<in R extends JsonObj, out V, in C = unknown> {
  has(this: Field<R, V>, p: Predicate<V>): Query<R>
  has<V>(this: Field<R, Arr<V>>, p: Predicate<V>): Query<R>
  has(p: Predicate<V>): Query<R> {
    return {
      raw: f => ({ [`${f.of(this)}`]: p.raw }),
      expr: p.expr(this),
    }
  }
  private constructor(
    private field: string,
    private raw: (x: string) => string,
  ) {}
  static root = <T extends JsonObj>() => new Field<T, T>('', s => (s ? `$${s}` : '$$ROOT'))
  static ctx = <T, K extends string>(k: K) =>
    new Field<JsonObj, T, RORec<K, T>>(k, s => `$$${s}`)

  public of<V, K extends keyof V, _ extends 0>(this: Field<R, Arr<V>>, k: K): Field<R, Arr<V[K]>>
  public of<V, K extends keyof V, _ extends 1>(
    this: Field<R, Arr<V> | N>,
    k: K,
  ): Field<R, Arr<V[K]> | N>
  public of<V, K extends keyof V, _ extends 2>(this: Field<R, O<V>>, k: K): Field<R, V[K]>
  public of<V, K extends keyof V, _ extends 3>(this: Field<R, O<V> | N>, k: K): Field<R, V[K] | N>
  public of<K extends string & keyof V>(k: K): Field<R, V[K] | Arr<V[K]> | N> {
    return new Field([this.field, k].filter(id).join('.'), this.raw)
  }
  str(this: Field<R, V>) {
    return this.field
  }
  exprRaw(): ExprRaw<V, R, C> {
    return asExprRaw(this.raw(this.field))
  }
  static expr<R, V, C>(path: Path<R, V, C>) {
    return asExpr<V, R, C>({
      raw: f => path(f).exprRaw(),
    })
  }
}

export type Path<in R, out V, in Ctx> = <D extends JsonObj, C>(root: Field<D, R, C>) => Field<D, V, C & Ctx>
export const { root, expr, ctx } = Field

export type JField<T extends JsonObj, S> = Field<T, S> | Field<T, Arr<S>>
