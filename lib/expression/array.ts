import type { App, Arr, HKT, N, O, RORec, Rec, notArr } from '../../types'
import { ctx } from '../field'
import type { Expr } from '../types'
import { gte, add } from './arith'
import { field } from './concat'
import { asBoolExpr, asExpr, asExprRaw } from './expr-base'
import { eq, ite } from './logic'
import { $let, val } from './val'

export const size = <T, D, C>(expr: Expr<Arr<T>, D, C>) =>
  asExpr<number, D, C>({
    raw: f => asExprRaw({ $size: expr.raw(f).get() }),
  })

export const filterDefined = <T, D, C = unknown>(expr: Expr<Arr<T | N>, D, C>) =>
  filter({
    expr,
    as: 'x',
    cond: ctx()('x').expr(),
  }) as Expr<Arr<T>, D, C>

export const filter = <T, D, K extends string, C = unknown>({
  as,
  cond,
  expr,
  limit,
}: {
  expr: Expr<Arr<T>, D, C>
  as: K
  cond: Expr<unknown, D, C & RORec<K, T>>
  limit?: Expr<number, D, C>
}) =>
  asExpr<Arr<T>, D, C>({
    raw: f =>
      asExprRaw({
        $filter: {
          input: expr.raw(f).get(),
          as,
          cond: cond.raw(f).get(),
          limit: limit?.raw(f).get(),
        },
      }),
  })
export const sortArray = <T, D, C, K extends keyof T>({
  sortBy,
  expr,
  order,
}: {
  expr: Expr<Arr<T>, D, C>
  sortBy: K
  order?: 1 | -1
}) =>
  asExpr<Arr<T>, D, C>({
    raw: f =>
      asExprRaw({ $sortArray: { input: expr.raw(f).get(), sortBy: { [sortBy]: order ?? -1 } } }),
  })

export const isArray = <T extends notArr, D, C, F extends HKT<T | Arr<T>>>(
  expr: Expr<T | Arr<T>, D & (App<F, T> | App<F, Arr<T>>), C>,
) =>
  asBoolExpr<D & App<F, Arr<T>>, D & App<F, T>, C>({
    raw: f => asExprRaw<never, unknown, C>({ $isArray: expr.raw(f).get() }),
  })

export const array = <T, D, C = unknown>(...exprs: Expr<T, D, C>[]) =>
  asExpr<Arr<T>, D, C>({
    raw: f => asExprRaw(exprs.map(x => x.raw(f).get())),
  })

export const concatArray = <T, D, C>(...exprs: Expr<Arr<T>, D, C>[]) =>
  asExpr<Arr<T>, D, C>({
    raw: f => asExprRaw({ $concatArrays: exprs.map(x => x.raw(f).get()) }),
  })

export const first = <T, D, C>(expr: Expr<Arr<T>, D, C>) =>
  asExpr<T | null, D, C>({
    raw: f => asExprRaw({ $first: expr.raw(f).get() }),
  })
export const firstSure = first as <T, D, C>(expr: Expr<Arr<T>, D, C>) => Expr<T, D, C>
export const last = <T, D, C>(expr: Expr<Arr<T>, D, C>) =>
  asExpr<T | null, D, C>({
    raw: f => asExprRaw({ $last: expr.raw(f).get() }),
  })

export type NullToOBJ<N extends null> = N extends null ? O : N

export const mergeObjects = <T1, T2, D, C = unknown, N extends null = never>(
  ...exprs: readonly [Expr<T1 | N, D, C>, Expr<T2, D, C>]
) =>
  asExpr<(T1 | NullToOBJ<N>) & T2, D, C>({
    raw: f => asExprRaw({ $mergeObjects: exprs.map(x => x.raw(f).get()) }),
  })

export const inArray = <T, D, C = unknown>(...exprs: readonly [Expr<T, D, C>, Expr<Arr<T>, D, C>]) =>
  asExpr<boolean, D, C>({
    raw: f => asExprRaw({ $in: exprs.map(x => x.raw(f).get()) }),
  })

type Reduce<T, V> = RORec<'value', V> & RORec<'this', T>
const reduce = <T, V, D, C>(
  input: Expr<Arr<T>, D, C>,
  initialValue: Expr<V, D, C>,
  inExpr: Expr<V, D, C & Reduce<T, V>>,
) =>
  asExpr<V, D, C>({
    raw: f =>
      asExprRaw({
        $reduce: {
          input: input.raw(f).get(),
          initialValue: initialValue.raw(f).get(),
          in: inExpr.raw(f).get(),
        },
      }),
  })

const indexOfArray = <T, D, C>(array: Expr<Arr<T>, D, C>, item: Expr<T, D, C>) =>
  asExpr<number, D, C>({
    raw: f =>
      asExprRaw({
        $indexOfArray: [array.raw(f).get(), item.raw(f).get()],
      }),
  })
type DiffArr<T> = Rec<'out' | 'except', Arr<T>>
export const slice = <T, D, C>(
  array: Expr<Arr<T>, D, C>,
  start: Expr<number, D, C>,
  end: Expr<number, D, C>,
) =>
  asExpr<Arr<T>, D, C>({
    raw: f =>
      asExprRaw({
        $slice: [array.raw(f).get(), start.raw(f).get(), end.raw(f).get()],
      }),
  })
export const except = <T, D, C>(a: Expr<Arr<T>, D, C>, b: Expr<Arr<T>, D, C>) => {
  type C1 = C & Reduce<T, DiffArr<T>>
  type C2 = C1 & RORec<'indexInExcept', number>
  const value = ctx<DiffArr<T>>()('value')
  const out = value.of('out').expr()
  const except = value.of('except').expr()
  const curr = ctx<T>()('this').expr()
  const indexInExcept = ctx<number>()('indexInExcept').expr()
  return $let<Arr<T>, D, C, RORec<'res', DiffArr<T>>>(
    {
      res: [
        'res',
        reduce<T, DiffArr<T>, D, C>(
          a,
          field({ out: ['out', array<T, D>()], except: ['except', b] }),
          $let<DiffArr<T>, D, C1, RORec<'indexInExcept', number>>(
            {
              indexInExcept: ['indexInExcept', indexOfArray<T, D, C1>(except, curr)],
            },
            ite<DiffArr<T>, D, C2>(
              gte(indexInExcept, val(0)),
              field({
                out: ['out', out],
                except: [
                  'except',
                  concatArray<T, D, C2>(
                    ite<Arr<T>, D, C2>(
                      eq(indexInExcept)(val(0)),
                      array<T, D>(),
                      slice<T, D, C2>(except, val(0), indexInExcept),
                    ),
                    slice<T, D, C2>(except, add(indexInExcept, val(1)), size(except)),
                  ),
                ],
              }),
              field({
                out: ['out', concatArray<T, D, Reduce<T, DiffArr<T>>>(out, array(curr))],
                except: ['except', except],
              }),
            ),
          ),
        ),
      ],
    },
    ctx<DiffArr<T>>()('res').of('out').expr(),
  )
}
