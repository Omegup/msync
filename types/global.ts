import type { App, AppMap, AppMapRW, HKT, PromiseHKT } from '.'

export type AsNum<R> = R extends `${infer A extends number}` ? A : never
export type GetDom<Dom = unknown> = readonly [readonly Dom[], keyof any]

declare global {
  type Entry<T> = { [k in keyof T]: readonly [string & k, T[k]] }[keyof T]
  interface ObjectConstructor {
    entries<T, _ = 0>(object?: T): readonly Entry<T>[]
    fromEntries<T, _ = 0>(entries: readonly Entry<T>[]): T
    keys<T, _ extends 1>(obj: T): (keyof T)[]
  }
  interface ReadonlyArray<T> {
    includes<T, V extends T>(this: ReadonlyArray<V>, item: T, fromIndex?: number): item is V
    map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U, thisArg?: any): U[]
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
