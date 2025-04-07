import type { N, O, rawItem } from '../../types'
import type { Query } from '../types'
import { defined } from '../utils/json'

type Many<T> = readonly (T | N)[]
type Operator = `$${string}`
type Result<Dom> = Dom | { readonly [_ in Operator]: readonly Dom[] }
type Combiner = {
  <T extends O, C = unknown>(first: Query<T, C>, ...args: Many<Query<T, C>>): Query<T, C>
  <T extends O, C = unknown>(...args: Many<Query<T, C>>): Query<T, C> | undefined
}
type ApplyOpertorToMaybePreItems = <T>(
  op: Operator,
  args: Many<T>,
) => undefined | (<Dom extends rawItem>(map: (x: T) => Dom) => Result<Dom>)
type ApplyOpertorToPreItems = <T>(
  op: Operator,
  x: readonly T[],
) => undefined | (<Dom extends rawItem>(map: (x: T) => Dom) => Result<Dom>)
const filterUndefined = (applyOperator: ApplyOpertorToPreItems): ApplyOpertorToMaybePreItems => {
  return (op, args) => applyOperator(op, args.filter(defined))
}
const combine =
  (op: Operator, applyOperatorToPreItems: ApplyOpertorToMaybePreItems): Combiner =>
  <T extends O, C>(...args: Many<Query<T, C>>): Query<T, C> => {
    const mapToItems = applyOperatorToPreItems<Query<T, C>>(op, args)
    return mapToItems! && { raw: field => mapToItems(x => x.raw(field)) }
  }
const all: ApplyOpertorToPreItems = (op, x) =>
  x.length === 0 ? undefined : f => ({ [op]: x.map(f) })
const first: ApplyOpertorToPreItems = (op, x) => (x.length === 1 ? f => f(x[0]) : all(op, x))
export const $and: Combiner = combine('$and', filterUndefined(first))
export const $nor: Combiner = combine('$nor', filterUndefined(all))
export const $or: Combiner = combine('$or', filterUndefined(first))
