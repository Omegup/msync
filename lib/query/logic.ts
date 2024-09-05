import type { JsonObj, N, rawItem } from '../../types'
import { asExpr, asExprRaw } from '../expression/expr-base'
import type { Query } from '../types'
import { defined } from '../utils/json'

type Many<T> = readonly (T | N)[]
type Result<Dom> = Dom | { readonly [_: string]: readonly Dom[] }
type Combiner = {
  <T extends JsonObj, C>(first: Query<T, C>, ...args: Many<Query<T, C>>): Query<T, C>
  <T extends JsonObj, C>(...args: Many<Query<T, C>>): Query<T, C> | undefined
}
type Maker = <T>(
  op: string,
  args: Many<T>,
) => undefined | (<Dom extends rawItem>(map: (x: T) => Dom) => Result<Dom>)
type Alter = <T>(
  op: string,
  x: readonly T[],
) => undefined | (<Dom extends rawItem>(f: (x: T) => Dom) => Result<Dom>)
const make = (alter: Alter): Maker => {
  return (op, args) => alter(op, args.filter(defined))
}
export const combine =
  (op: string, make: Maker): Combiner =>
  <T extends JsonObj, C>(...args: Many<Query<T, C>>): Query<T, C> => {
    const q = make<Query<T, C>>(op, args)
    return (
      q! && {
        raw: field => q(x => x.raw(field)),
        expr: asExpr<boolean, T, C>({
          raw: f => asExprRaw(q(x => x.expr.raw(f).get())),
        }),
      }
    )
  }
const all: Alter = (op, x) => (x.length === 0 ? undefined : f => ({ [op]: x.map(f) }))
const first: Alter = (op, x) => (x.length === 1 ? f=>f(x[0]) : all(op, x))
export const $and = combine('$and', make(first))
export const $nor = combine('$nor', make(all))
export const $or = combine('$or', make(first))
