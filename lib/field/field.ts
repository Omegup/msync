import type {
  App,
  Arr,
  ArrHKT,
  ArrayHKT,
  HKT,
  IdHKT,
  ItemsHKT,
  JsonObj,
  N,
  O,
  Rec,
  RecHKT,
  Type,
  notArr,
  µ,
} from '../../types'
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
  public of<V, K extends keyof V>(this: Field<R, Arr<V>>, k: K): Field<R, Arr<V[K]>>
  public of<V, K extends keyof V>(this: Field<R, Arr<V> | N>, k: K): Field<R, Arr<V[K]> | N>
  public of<V, K extends keyof V>(this: Field<R, O<V>>, k: K): Field<R, V[K]>
  public of<V, K extends keyof V>(this: Field<R, O<V> | N>, k: K): Field<R, V[K] | N>
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

const parts = Symbol()
type Field2<in R, out V> = {
  get?(x: R): V
  readonly [parts]: string[]
  p: typeof prev
}

const $ = <T>(): Field2<T, T> => ({ [parts]: [], p: prev })
const prev: {
  <T, V extends notArr, K extends string>(
    this: Field2<T, V>,
    k: K,
  ): Field2<Rec<K, T>, V> & Field2<Arr<Rec<K, T>>, Arr<V>>
  <T, V, K extends string>(
    this: Field2<T, Arr<V>>,
    k: K,
  ): Field2<Rec<K, T> | Arr<Rec<K, T>>, Arr<V>>
} = function (this: { [parts]: string[] }, k: string) {
  return { p: prev, [parts]: [k, ...this[parts]] }
}

const erer: Field2<Rec<'value', number>, number> & Field2<Arr<Rec<'value', number>>, Arr<number>> =
  $<number>().p('value')
const sf: Field2<unknown, number> = erer
const sf2: Field2<Rec<'value', number>, number> = sf

const prevArr = <T, V, K extends string>(
  f: Field2<T, O<V> | Arr<V>>,
  k: K,
): Field2<Arr<Rec<K, T>>, Arr<V>> => ({ get: x => f.get(x[k]) })

declare const PathType: unique symbol
const Path = Symbol()
export type Path<in F extends HKT<Dom, JsonObj>, in Dom = unknown> = {
  [Type]?(type: typeof PathType): void
  [PathType]?<T extends Dom>(x: App<F, T>): T
  [Path]: readonly string[]
}

export const s: {
  <T extends JsonObj = JsonObj>(): Path<IdHKT<T>, T>
  <K extends string>(k: K): Path<RecHKT<K>>
} = (...k: string[]) => ({ [Path]: k })

export const then: {
  <F extends HKT<GIm, JsonObj>, G extends HKT<GDom, GIm>, GIm extends JsonObj, GDom = unknown>(
    p1: Path<F, GIm>,
    p2: Path<G, GDom>,
  ): Path<µ<[G, F], GDom, GIm, JsonObj>, GDom>
  <
    F extends HKT<Arr<GIm>, JsonObj>,
    G extends HKT<Arr<GDom>, GIm>,
    GIm extends JsonObj,
    GDom = unknown,
  >(
    p1: Path<F, Arr<GIm>>,
    p2: Path<G, Arr<GDom>>,
  ): Path<
    µ<[µ<[G, ArrHKT<GIm>], Arr<GDom>, GIm, Arr<GIm>>, F], Arr<GDom>, Arr<GIm>, JsonObj>,
    Arr<GDom>
  >
  <F extends HKT<Arr<GIm>, JsonObj>, G extends HKT<GDom, GIm>, GIm extends JsonObj, GDom = unknown>(
    p1: Path<F, Arr<GIm>>,
    p2: Path<G, GDom>,
  ): Path<
    µ<
      [µ<[µ<[ItemsHKT<GDom>, G], Arr<GDom>, GDom, GIm>, ArrHKT<GIm>], Arr<GDom>, GIm, Arr<GIm>>, F],
      Arr<GDom>,
      Arr<GIm>,
      JsonObj
    >,
    Arr<GDom>
  >
} = (p1: Path<never, never>, p2: Path<never, never>) => ({
  [Path]: [...p1[Path], ...p2[Path]],
})

const rawPath = (p: { [Path]: readonly string[] }) => {
  const parts = p[Path]
  if (!parts.length) return '$$ROOT'
  return `$${parts.join('.')}`
}

export const expr = <G extends HKT<T, JsonObj>, T = unknown>(
  path: Path<G, T>,
): Expr<T, App<G, T>> => ({
  raw: f => rawPath(then(f, path)),
})

export const { root } = Field

export type JField<T extends JsonObj, S> = Field<T, S> | Field<T, Arr<S>>
