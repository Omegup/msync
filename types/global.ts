export type AsNum<R> = R extends `${infer A extends number}` ? A : never
export type GetDom<Dom = unknown> = readonly [readonly Dom[], keyof any]
