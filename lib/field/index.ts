import type { DeepGet, Idx, Inner, Items, Key, WeakGet, jsonItem } from '../../types'
import type { Expr, Query, QueryRaw } from '../types'
import type { Predicate } from '../types/predicate'
import { deepGet } from '../utils/json'

export interface Field<T extends jsonItem, D, V = unknown> {
  readonly field: string
  has(predicate: Predicate<D>): Query<T>
  expr: () => Expr<V, T, unknown>
}
export class Path<T extends jsonItem, F, I, V> implements Field<T, I | Items<F>, V> {
  private constructor(
    readonly field: string,
    private readonly _expr: (x: T) => V,
  ) {}
  static root = <T extends jsonItem>() => new Path<T, never, T, T>('', x => x)
  expr = (): Expr<V, T, unknown> => ({
    eval: this._expr,
    raw: () => (this.field ? `$${this.field}` : '$$ROOT'),
  })
  ctx = (): Expr<V, unknown, T> => ({
    eval: (_, ctx) => this._expr(ctx),
    raw: () => `$$${this.field}`,
  })
  has({ raw }: Predicate<Items<F> | I>): Query<T> {
    return {
      raw: prefix => {
        const field = prefix(this.field)
        return field ? { [field]: raw } : (raw as QueryRaw)
      },
    }
  }
  public of<K extends Key<Items<F | I>> | Idx<F | I>>(k: K) {
    type D = F | I
    type NewF = D extends readonly unknown[] ? WeakGet<Inner<D>, K> : WeakGet<D, K>
    type NewI = D extends readonly unknown[] ? (K extends Idx<D> ? D[K] : never) : never
    return new Path<T, NewF, NewI, DeepGet<V, K>>(
      this.field ? `${this.field}.${k.toString()}` : k.toString(),
      x => deepGet([this._expr(x)], k)[0],
    )
  }
}

export const { root } = Path
