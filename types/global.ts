export type AsNum<R> = R extends `${infer A extends number}` ? A : never
export type GetDom<Dom = unknown> = readonly [readonly Dom[], keyof any]
export type Exclude<T, U> = T & not U;
export type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
