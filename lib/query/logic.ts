import type { JsonObj, N, rawItem } from '../../types'
import type { Query } from '../types'
import { defined } from '../utils/json'

type Many<T> = readonly (T | N)[]
type Result<Dom> = Dom | { readonly [_: string]: readonly Dom[] } | undefined
type Combiner = {
  <T extends JsonObj, C>(first: Query<T, C>, ...args: Many<Query<T, C>>): Query<T, C>
  <T extends JsonObj, C>(...args: Many<Query<T, C>>): Query<T, C> | undefined
}
type Maker = <T, Dom extends rawItem>(op: string, args: Many<T>, map: (x: T) => Dom) => Result<Dom>
type Alter = <Dom extends rawItem>(op: string, x: readonly Dom[]) => Result<Dom>
const make = (alter: Alter): Maker => {
  return (op, args, map) => alter(op, args.filter(defined).map(map))
}
export const combine =
  (op: string, make: Maker): Combiner =>
  <T extends JsonObj, C>(...args: Many<Query<T, C>>): Query<T, C> => ({
    raw: field => make(op, args, x => x.raw(field))!,
    expr: { raw: f => make(op, args, x => x.expr.raw(f))! },
  })
const all: Alter = (op, x) => (x.length === 0 ? undefined : { [op]: x })
const first: Alter = (op, x) => (x.length === 1 ? x[0] : all(op, x))
export const $and = combine('$and', make(first))
export const $nor = combine('$nor', make(all))
export const $or = combine('$or', make(first))
