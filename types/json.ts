import type { Timestamp } from 'mongodb'
import type { Type } from './class'

export type U = undefined
export type N = null | U
export type jsonPrim = number | null | string | boolean | Timestamp | Date
export type notObj = jsonPrim | U
export type notArr = notObj | J
export type jsonItem = jsonPrim | json
export type rawItem = jsonPrim | raw | U
export type Undef<I extends U> = I | (I extends never ? I : notObj)
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
export interface J {
  [Type]: typeof object
  readonly [_: string]: jsonItem | U
}
export type J2 = readonly [J, J]
export type J3 = readonly [J, J, J]
export type ID = { readonly _id: string }
export type doc = J & ID
export interface RawObj {
  readonly [_: string]: rawItem | U
}
export type json = JsonArr | J
export type raw = readonly rawItem[] | RawObj

export type StrKey<T> = string & keyof T

// a generic type that restricts another type to be a literal
// for exemple AsLiteral<'a'> is 'a' and AsLiteral<string> is never, AsLiteral<1> is 1 and AsLiteral<number> is never
export type AsLiteral<T extends string | boolean> = {} extends { [K in `${T}`]: 1 }
  ? never
  : NoUnion<T>
type NoUnion<T, V = T> = T extends unknown ? ([V] extends [T] ? T : never) : never
