import type { Arr, JsonObj, N, O } from '../../types'
import type { Expr, ExprRaw, Query } from '../types'
import type { Predicate } from '../types/predicate'
import { id } from '../utils/json'

export class Field<in R extends JsonObj, out V> implements Expr<V, R, unknown> {
  raw = <DeltaD extends JsonObj>(f: Field<DeltaD, R>): ExprRaw<V, DeltaD, unknown, string> =>
    this.field ? `$${this.field}` : '$$ROOT'
  has(p: Predicate<V>): Query<R>
  has<V>(this: Field<R, Arr<V>>, p: Predicate<V>): Query<R>
  has(p: Predicate<V>): Query<R> {
    return {
      raw: f => ({ [`${f.of(this)}`]: p.raw }),
      expr: p.expr(this),
    }
  }
  private constructor(private field: string) {}
  static root = <T extends JsonObj>() => new Field<T, T>('')
  public of<V, K extends keyof V, _ extends 0>(this: Field<R, Arr<V>>, k: K): Field<R, Arr<V[K]>>
  public of<V, K extends keyof V, _ extends 1>(
    this: Field<R, Arr<V> | N>,
    k: K,
  ): Field<R, Arr<V[K]> | N>
  public of<V, K extends keyof V, _ extends 2>(this: Field<R, O<V>>, k: K): Field<R, V[K]>
  public of<V, K extends keyof V, _ extends 3>(this: Field<R, O<V> | N>, k: K): Field<R, V[K] | N>
  public of<V, W>(this: Field<R, O<V>>, k: Field<O<V>, W>): Field<R, W>
  public of<V, W>(this: Field<R, O<V> | N>, k: Field<O<V>, W>): Field<R, W | N>
  public of<V, W>(this: Field<R, O<V>>, k: Field<O<V>, W>): Field<R, W>
  public of<V, W>(this: Field<R, Arr<V> | N>, k: Field<O<V>, Arr<W> | O<W>>): Field<R, Arr<W> | N>
  public of<K extends string & keyof V>(k: K): Field<R, V[K] | Arr<V[K]> | N> {
    return new Field([this.field, `${k}`].filter(id).join('.'))
  }
  toString() {
    return this.field
  }
}

export const { root } = Field

export type JField<T extends JsonObj, S> = Field<T, S> | Field<T, Arr<S>>
