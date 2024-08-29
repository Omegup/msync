import type { Timestamp } from 'mongodb'
import type { Type } from './class'

export type N = null | undefined
export type jsonPrim = number | null | string | boolean | Timestamp | Date
export type notArr = jsonPrim | JsonObj | undefined
export type jsonItem = jsonPrim | json
export type rawItem = jsonPrim | raw | undefined
export declare const object: unique symbol
export declare const array: unique symbol
export interface JsonArr {
  [Type]: typeof array
  readonly [_: number]: jsonItem | undefined
}
export type A = { [Type]: typeof array }
export type Arr<T, N extends number = number> = A & { readonly [_ in N]: T }
export type O<T = unknown> = { [Type]: typeof object } & T
export type Rec<K extends string, T = unknown> = O<{ readonly [P in K]: T }>
export interface JsonObj {
  [Type]: typeof object
  readonly [_: string]: jsonItem | undefined
}
export type ID = O<{ _id: string }>
export type doc = JsonObj & ID
export interface RawObj {
  readonly [_: string]: rawItem | undefined
}
export type json = JsonArr | JsonObj
export type raw = readonly rawItem[] | RawObj

export type Inner<T> = T extends readonly unknown[] ? T[number] : never

export type Items<T> = T | Inner<T>
