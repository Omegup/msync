import type { App, AppMap, AppMapRW, HKT, PromiseHKT } from ".";

export type AsNum<R> = R extends `${infer A extends number}` ? A : never
export type GetDom = readonly [unknown, keyof any]

declare global {
  interface ReadonlyArray<T> {
    map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U, thisArg?: any): U[];
    map<V extends ReadonlyArray<unknown>, F extends HKT<unknown>, G extends HKT<unknown>>(
      this: AppMap<F, V>,
      callbackfn: <I extends keyof V>(value: App<F, V[I]>, index: AsNum<I>, array: V) => App<G, V[I]>,
      thisArg?: any
    ): AppMapRW<G, V>;
    map<V extends ReadonlyArray<unknown>, F extends HKT<unknown>, G extends HKT<GetDom>, _ extends 0 = 0>(
      this: AppMap<F, V>,
      callbackfn: <I extends keyof V>(value: App<F, V[I]>, index: AsNum<I>, array: V) => App<G, readonly [V, I]>,
      thisArg?: any
    ): AppMapRW<G, { [I in keyof V]: readonly [V, I] }, GetDom>;
  }
  interface PromiseConstructor {
    all<T extends readonly unknown[] | []>(values: AppMap<PromiseHKT, T>): Promise<T>;
    race<T extends readonly unknown[] | [], _ extends 0 = 0>(values: AppMap<PromiseHKT, T>): Promise<T[number]>;
    all<T extends readonly unknown[] | []>(values: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
    race<T extends readonly unknown[] | []>(values: T): Promise<Awaited<T[number]>>;
  }
}
