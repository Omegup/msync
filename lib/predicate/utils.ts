import type { App, HKT, rawItem } from '../../types'
import type { Predicate } from '../types'

type Operators = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$nin'
export const operator =
  <
    K extends Operators,
    F extends HKT<Dom, HKT<Dom, Dom>>,
    Dom extends rawItem = rawItem,
    Default extends Dom = Dom,
    G extends HKT<Dom, HKT<Dom, Dom>> = F,
  >() =>
  <D2 extends Dom = Default>(op: K) =>
  <T extends D2>(operand: App<App<F, D2>, T>): Predicate<App<App<G, D2>, T>> => {
    return {
      raw: { [op]: operand },
      expr: field => ({ raw: f => ({ [op]: [field.raw(f), operand] }) }),
    }
  }
