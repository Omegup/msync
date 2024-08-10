import { Timestamp } from "mongodb";

export type jsonItem = number | null | string | boolean | json | Timestamp | Date;
export interface JsonObj {
  readonly [_: string]: jsonItem | undefined;
}
export type json = readonly jsonItem[] | JsonObj;


export type RemoveIndex<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
    ? never
    : K]: T[K];
};

export type Inner<T> = T extends readonly unknown[] ? T[number] : never;

export type Items<T> = T | Inner<T>;

export type Key<T> = T extends readonly unknown[]
  ? never
  : string & keyof RemoveIndex<T>;
export type Idx<T> = T extends readonly unknown[]
  ? `${number}` & keyof RemoveIndex<T>
  : never;

export type Has<K extends string, A extends jsonItem> = {
  readonly [_ in K]: A;
};
export type WeakHas<K extends string, A extends jsonItem> = {
  readonly [_ in K]?: A;
};
export type WeakGet<T, K extends string> = T extends Has<K, infer A>
  ? A
  : T extends WeakHas<K, infer A>
  ? A | null
  : null;
type _Get<T, K extends string> = T extends Has<K, infer A> ? A : never;
export type DeepGet<T, K extends string> = T extends unknown[]
  ? { [P in keyof T]: DeepGet<T[P], K> }
  : _Get<T, K>;


