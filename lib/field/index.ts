import type {
  A,
  DeepGet,
  Idx,
  Inner,
  Items,
  JsonObj,
  Key,
  O,
  Type,
  WeakGet,
  json,
  jsonItem,
  notArr,
} from '../../types'
import { val } from '../expression/val'
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
  has({ raw }: Predicate<I | Items<F> | V>): Query<T> {
    return {
      raw: prefix => {
        const field = prefix(this.field)
        return field ? { [field]: raw } : (raw as QueryRaw)
      },
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

// types of field:
// Join Field --> T[]
// Updater Field --> K    $set(field({a: field({b: $.of('x').expr()}), b: expr.of('x').get()}))
// - Expression Field
// Query Field

type Par<K extends string> = { [P in K]?: unknown }
const set = <
  R,
  Old extends Par<K>,
  F extends { readonly [P in K]: FieldUpdaterRaw<R, Old[K], unknown> },
  K extends string = string & keyof F,
>(
  fields: F,
): FieldUpdaterRaw<
  R,
  Old,
  Omit<Old, K> &
    O & {
      readonly [P in K]: F[K] extends FieldUpdaterRaw<R, Old[K], infer A> ? A : never
    }
> => ({
  raw: Object.entries(fields).flatMap(([k, v]) => v.raw.map(([l, v]) => [`.${k}${l}`, v])),
})
const to = <R, V>(expr: Expr<V, R, unknown>): FieldUpdaterRaw<R, notArr, V> => ({
  raw: [['', expr.raw()]],
})
const items = <R, T, V>(x: FieldUpdaterRaw<R, T, V>) =>
  x as {} as FieldUpdaterRaw<R, Arr<T>, Arr<V>>

const sjs: FieldUpdaterRaw<Promise<void>, { x?: never }, { x: number }> = set({
  x: to(val(() => 4)),
})
const ee = <V>(updater: FieldUpdaterRaw<Promise<void>, O & { x: Arr<notArr>; y?: never }, V>) => updater
const sf = ee(set({ x: items(to(val(() => 1))) }))



type Arr<T, N extends number = number> = A & { readonly [_ in N]: T }

export class EField<in R, out V> {
  expr = (): Expr<V, R, unknown> => ({
    raw: () => (this.field ? `$${this.field}` : '$$ROOT'),
  })
  private constructor(private field: string) {}
  static $ = <T>() => new EField<T, T>('')
  public of<V, K extends keyof V>(this: EField<R, Arr<V>>, k: K): EField<R, Arr<V[K]>>
  public of<K extends keyof V>(k: K): EField<R, V[K]>
  public of<K extends string & keyof V>(k: K): EField<R, V[K] | Arr<V[K]>> {
    return new EField(`${this.field ? `${this.field}.` : ''}${k}`)
  }
}

export const { $ } = EField

const fe: EField<O<{ x: Arr<O<{ y: number }>> }>, Arr<number>> = $<
  O<{ x: Arr<O<{ y: number }>> }>
>()
  .of('x')
  .of('y')

type D = { a: Arr<A & { '0': (O & { b: number }) | (O & { c: number; b?: null }) }, 0> }
const ss = $<D>().of('a').of(0).of('b')

declare const FieldUpdaterRaw: unique symbol
export type FieldUpdaterRaw<in R, in T, out V> = {
  [Type]?(x: typeof FieldUpdaterRaw, c: R, t: T): V
  raw: readonly (readonly [string, jsonItem])[]
}

export class QField<in R, out V> {
  has = (p: Predicate<V>): Query<R> => ({
    raw: () => (this.field ? `$${this.field}` : '$$ROOT'),
  })
  private constructor(private field: string) {}
  static root = <T>() => new QField<T, T>('')
  public of<K extends keyof V>(k: K): QField<R, V[K]>
  public of<K extends keyof V>(this: QField<R, readonly V[]>, k: K): QField<R, readonly V[K][]>
  public of<K extends string & keyof V>(k: K): QField<R, V[K] | readonly V[K][]> {
    return new QField(`${this.field ? `${this.field}.` : ''}${k}`)
  }
}
