import type { App, HKT, rawItem } from '../../types'
import type { Predicate } from '../types'

type Operators = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$nin' | '$type' | '$exists'
export const operator =
  <
    K extends Operators,
    F extends HKT<Dom2, HKT<Dom1, unknown>>,
    Dom1,
    Dom2 = Dom1,
    G extends HKT<Dom2, HKT<Dom1, unknown>> = F,
  >() =>
  <D2 extends Dom2 = Dom2>(op: K) =>
  <T extends Dom1>(operand: rawItem & App<App<F, D2>, T>): Predicate<App<App<G, D2>, T>> => {
    return {
      raw: { [op]: operand },
    }
  }
