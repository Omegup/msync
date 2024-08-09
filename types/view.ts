import type { JsonObj } from './json'
import type { Query } from '../lib/types/query'
import type { Db } from 'mongodb'

type ReadonlyCollection<out T> = {
  out?: T
  readonly s: { readonly db: Db }
  collectionName: string
}

export type View<T extends JsonObj> = {
  collection: ReadonlyCollection<T>
  match?: Query<T>
  projection: Record<keyof T, 1>
}


type N0_ = {};
type N1_ = N0_ & { "_1": never };
type N2_ = N1_ & { "_2": never };

interface N0 { clear: N0_; next: N1; };
interface N1 { clear: N1_; value: "_1"; next: N2; prev: N0; };
interface N2 { clear: N2_; value: "_2"; prev: N1; };

type Next<N extends { next: any }> = N["next"];
type Prev<N extends { prev: any }> = N["prev"];
type Value<N extends { value: any }> = N["value"];

type PushField<T extends { state: { next: any, clear: any } }, TFieldType> =
	((T | T["state"]["clear"]) 
	& { [TKey in T["state"]["next"]["value"]]: TFieldType }) & { state: T["state"]["next"] };

type PopField<T extends { state: { prev: any, clear: any } }> =
	T & T["state"]["prev"]["clear"] & { state: T["state"]["prev"] };

type Simplify<T> = { [TKey in keyof T]: T[TKey] }

type Empty = { state: N0 };
type S1 = Simplify<PushField<Empty, "Test1">>;
type S2 = Simplify<PushField<S1, "Test2">>;
type S3 = Simplify<PopField<S1>>;

const x: S3;
x