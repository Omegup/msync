import type { DeepGet, Idx, Inner, Items, JsonObj, Key, WeakGet } from '../../types'
import { $eq } from '../predicate'
import type { Expr, Query, QueryRaw } from '../types'
import type { Predicate } from '../types/predicate'

export interface Field<in T extends JsonObj, out D, out V = D> {
  readonly field: string
  has(predicate: Predicate<D | V>): Query<T>
  expr: () => Expr<V, T, unknown>
}
export class Path<T extends JsonObj, F, I, V> implements Field<T, I | Items<F>, V> {
  private constructor(readonly field: string) {}
  static root = <T extends JsonObj>() => new Path<T, never, T, T>('')
  expr = (): Expr<V, T, unknown> => ({
    raw: () => (this.field ? `$${this.field}` : '$$ROOT'),
  })
  ctx = (): Expr<V, unknown, T> => ({
    raw: () => `$$${this.field}`,
  })
  has({ raw, expr }: Predicate<I | Items<F> | V>): Query<T> {
    return {
      raw: prefix => {
        const field = prefix(this.field)
        return field ? { [field]: raw } : (raw as QueryRaw)
      },
      expr: f => ({ raw: () => expr(this).raw() }),
    }
  }
  me: Field<T, I | Items<F>, V> = this
  public of<K extends Key<Items<F | I>> | Idx<F | I>>(k: K) {
    type D = F | I
    type NewF = D extends readonly unknown[] ? WeakGet<Inner<D>, K> : WeakGet<D, K>
    type NewI = D extends readonly unknown[] ? (K extends Idx<D> ? D[K] : never) : never
    return new Path<T, NewF, NewI, DeepGet<V, K>>(
      this.field ? `${this.field}.${k.toString()}` : k.toString(),
    )
  }
}

declare module '.' {
  export interface Path<T extends JsonObj, F, I, V> {
    // of<K extends Key<Items<F | I>> | Idx<F | I>>(k: K): Field<T, unknown, DeepGet<V, K>>
  }
}

export const { root } = Path

const fe: Field<{ x: {y: number}[] }, number, number[]> = root<{ x: {y: number}[] }>().of('x').of('y').me
fe.has($eq<number | number[]>(4))

