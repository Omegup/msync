import type { Rec } from "./json"

export interface HKT<in Dom = unknown, out Im = unknown> {
  readonly in: (x: Dom) => void
  readonly out: Im
}

export type App<F extends HKT<X>, X> = (F & {
  readonly in: (x: X) => void
})['out']

export type I<Dom, F extends HKT<Dom>> = F['in'] extends (x: infer X extends Dom) => void ? X : never






export interface ArrHKT<Dom = unknown> extends HKT<Dom> {
  readonly out: readonly I<Dom, this>[]
}

export interface IdHKT<Dom = unknown> extends HKT<Dom> {
  readonly out: I<Dom, this>
}

export interface RConstHKT<Im, Dom = Im> extends HKT<Im, HKT<Dom, Im>> {
  readonly out: ConstHKT<I<Im, this>, Dom>
}

export interface ConstHKT<Im, Dom = unknown> extends HKT<Dom, Im> {
  readonly out: Im
}

type ApplyF<Dom, Im, T extends [Dom, HKT<Dom, Im>]> = App<T[1], T[0]>

export interface ApplyHKT<Dom, Im> extends HKT<[Dom, HKT<Dom, Im>], Im> {
  readonly out: ApplyF<Dom, Im, I<[Dom, HKT<Dom, Im>], this>>
}

export interface µ<X extends [HKT<A, B>, HKT<B, C>], A = unknown, B = unknown, C = unknown> extends HKT<A, C> {
  readonly out: App<X[1], App<X[0], I<A, this>>>
}

export type AppMap<F extends HKT<Dom>, X extends readonly Dom[], Dom = unknown> = readonly App<F, Dom>[] & {
  [I in keyof X]: App<F, X[I]>
}

export type AppMapRW<F extends HKT<Dom>, X extends readonly Dom[], Dom = unknown> = App<F, Dom>[] & {
  [I in keyof X]: App<F, X[I]>
}
export interface PromiseHKT<Dom = unknown> extends HKT<Dom> {
  readonly out: PromiseLike<I<Dom, this>>
}

export interface DeepFieldHKT<R, T, K extends keyof T, F extends HKT<R, T>>
  extends HKT<R, T[K]> {
  readonly out: App<F, I<R, this>>[K]
}

export interface FieldHKT<K extends string> extends DeepFieldHKT<Record<K, unknown>, Record<K, unknown>, K, IdHKT<Record<K, unknown>>> {}
export interface RecordHKT<K extends string, Dom = unknown> extends HKT<Dom, Record<K, Dom>> {
  readonly out: Record<K, I<Dom, this>>
}
export interface RecHKT<K extends string, Dom = unknown> extends HKT<Dom, Rec<K, Dom>> {
  readonly out: Rec<K, I<Dom, this>>
}
