import type { jsonItem, App, HKT } from '../../types'
import type { DeepTest, Predicate } from '../types'
import eq from 'fast-deep-equal'

export const equal = (a: unknown, b: unknown) => (a == null && b == null) || eq(a, b)

export type AsDeepTest = <T>(testOnPart: (part: T) => boolean) => DeepTest<T>

type Operators = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$nin'
export const makeDualOperandPredicate =
  <K extends Operators, F extends HKT<Dom, jsonItem>, Dom extends jsonItem = jsonItem>() =>
  <D2 extends Dom = Dom>(op: K) =>
  <T extends D2>(operand: App<F, T>): Predicate<T> => {
    return {
      expr: x => ({ raw: () => ({ [op]: [x.expr().raw(), operand] }) }),
      raw: { [op]: operand },
    }
  }
