import type { Timestamp } from 'mongodb'
import type { Type } from './class'

export type U = undefined
export type N = null | U
export type jsonPrim = number | null | string | boolean | Timestamp | Date
export type notObj = jsonPrim | U
export type notArr = notObj | O
export type jsonItem = unknown
export type rawItem = jsonPrim | raw | U
export type Undef<I extends N> = I | (I extends never ? I : notObj)
export declare const object: unique symbol
export declare const array: unique symbol
export interface JsonArr {
  [Type]: typeof array
  readonly [_: number]: jsonItem | U
}
export type A = { [Type]: typeof array }
export type Arr<T, N extends number = number> = A & { readonly [_ in N]: T }
type Obj = { [Type]: typeof object }
export type O<T = unknown> = Obj & T
export type RORec<K extends keyof never, T = unknown> = { readonly [P in K]: T }
export type Par<K extends string, V extends Rec<K, jsonItem>> = { readonly [k in K]?: V[k] | N }
export type Rec<K extends string, T = unknown> = O<RORec<K, T>>
export type O2 = readonly [O, O]
export type O3 = readonly [O, O, O]
export type ID = { readonly _id: string }
export type doc = O & ID
export interface RawObj {
  readonly [_: string]: rawItem | U
}
export type raw = readonly rawItem[] | RawObj

export type StrKey<T> = string & keyof T
export type Replace<R, V> = Omit<R, StrKey<V>> & V & O

// a generic type that restricts another type to be a literal
// for exemple AsLiteral<'a'> is 'a' and AsLiteral<string> is never, AsLiteral<1> is 1 and AsLiteral<number> is never
export type AsLiteral<T extends keyof any | boolean, V = NoUnion<T>> = T extends keyof any
  ? {} extends { [K in T]: 1 }
    ? never
    : V
  : V
type NoUnion<T, V = T> = T extends unknown ? ([V] extends [T] ? T : never) : never
export type Literal<K> = string extends K ? never : K
export type RemoveSignature<T> = { [K in keyof T as Literal<K>]: T[K] }
