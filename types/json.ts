import type { Timestamp } from 'mongodb'
import type { Type } from './class'

export type jsonPrim = number | null | string | boolean | Timestamp | Date
export type notArr = jsonPrim | JsonObj | undefined
export type jsonItem = jsonPrim | json
export declare const object: unique symbol
export declare const array: unique symbol
export interface JsonArr {
  [Type]: typeof array
  readonly [_: number]: jsonItem | undefined
}
export type A = { [Type]: typeof array }
export type O<T = unknown> = { [Type]: typeof object } & T
export interface JsonObj {
  [Type]: typeof object
  readonly [_: string]: jsonItem | undefined
}
export type json = JsonArr | JsonObj

export type RemoveIndex<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
}

export type Inner<T> = T extends readonly unknown[] ? T[number] : never

export type Items<T> = T | Inner<T>

export type Key<T> = T extends readonly unknown[] ? never : string & keyof RemoveIndex<T>
export type Idx<T> = T extends readonly unknown[] ? `${number}` & keyof RemoveIndex<T> : never

export type Has<K extends string, A extends jsonItem> = {
  readonly [_ in K]: A
}
export type WeakHas<K extends string, A extends jsonItem> = {
  readonly [_ in K]?: A
}
export type WeakGet<T, K extends string> =
  T extends Has<K, infer A> ? A : T extends WeakHas<K, infer A> ? A | null : null
type _Get<T, K extends string> = T extends Has<K, infer A> ? A : never
export type DeepGet<T, K extends string> = T extends unknown[]
  ? { [P in keyof T]: DeepGet<T[P], K> }
  : _Get<T, K>
