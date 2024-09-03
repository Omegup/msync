import type { App, AppMap, AppMapRW, HKT, PromiseHKT, RORec } from '.'

export type AsNum<R> = R extends `${infer A extends number}` ? A : never
export type GetDom<Dom = unknown> = readonly [readonly Dom[], keyof any]

declare global {
  type Entry<T, K extends keyof T = keyof T> = readonly [string, T[string & K]] &
    { [k in K]: readonly [string & k, T[k]] }[K]
  interface ObjectConstructor {
    entries<T, _ = 0>(object?: T): readonly Entry<T>[]
    fromEntries<T, _ = 0>(entries: readonly Entry<T>[]): T
    keys<T, _ extends 1>(obj: T): (keyof T)[]
  }
  interface ReadonlyArray<T> {
    includes<T, V extends T>(this: ReadonlyArray<V>, item: T, fromIndex?: number): item is V
    map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U, thisArg?: any): U[]
    map<K extends string, T extends RORec<K>, U extends RORec<K>, _ extends 2 = 2>(
      this: readonly Entry<T, K>[],
      callbackfn: <P extends K>(
        value: [P, T[P]],
        index: number,
        array: this,
      ) => readonly [P, U[P]],
      thisArg?: any,
    ): readonly Entry<U, K> []
    map<
      V extends ReadonlyArray<unknown>,
      F extends HKT<unknown>,
      G extends HKT<unknown>,
      _ extends 1 = 1,
    >(
      this: AppMap<F, V>,
      callbackfn: <I extends keyof V>(
        value: App<F, V[I]>,
        index: AsNum<I>,
        array: V,
      ) => App<G, V[I]>,
      thisArg?: any,
    ): AppMapRW<G, V>
    reduce<U>(
      callbackfn: (
        previousValue: U,
        currentValue: T,
        currentIndex: number,
        array: readonly T[],
      ) => U,
      initialValue: U,
    ): U
    reduce<V extends ReadonlyArray<unknown>, F extends HKT, U>(
      this: AppMap<F, V>,
      callbackfn: <I extends keyof V>(
        previousValue: U,
        currentValue: App<F, V[I]>,
        currentIndex: AsNum<I>,
        array: V,
      ) => U,
      initialValue: U,
    ): U
    map<
      V extends ReadonlyArray<Dom>,
      F extends HKT<Dom>,
      G extends HKT<GetDom<Dom>>,
      Dom = unknown,
      _ extends 0 = 0,
    >(
      this: AppMap<F, V, Dom>,
      callbackfn: <I extends keyof V>(
        value: App<F, V[I] & Dom>,
        index: AsNum<I>,
        array: V,
      ) => App<G, readonly [V, I]>,
      thisArg?: any,
    ): AppMapRW<G, { [I in keyof V]: readonly [V, I] }, GetDom<Dom>>
  }
  interface PromiseConstructor {
    all<T extends readonly unknown[] | []>(values: AppMap<PromiseHKT, T>): Promise<T>
    race<T extends readonly unknown[] | [], _ extends 0 = 0>(
      values: AppMap<PromiseHKT, T>,
    ): Promise<T[number]>
    all<T extends readonly unknown[] | []>(
      values: T,
    ): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>
    race<T extends readonly unknown[] | []>(values: T): Promise<Awaited<T[number]>>
  }
}
