import type { App, HKT, J, rawItem } from '../../types'
import { asExpr, asExprRaw } from '../expression/expr-base'
import type { Field } from '../field'
import type { Predicate } from '../types'

type Operators = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$nin'
export const operator =
  <
    K extends Operators,
    F extends HKT<Dom, HKT<Dom, Dom>>,
    Dom extends unknown,
    Default extends Dom = Dom,
    G extends HKT<Dom, HKT<Dom, Dom>> = F,
  >() =>
  <D2 extends Dom = Default>(op: K) =>
  <T extends D2>(operand: rawItem & App<App<F, D2>, T>): Predicate<App<App<G, D2>, T>> => {
    type V = App<App<G, D2>, T>
    return {
      raw: { [op]: operand },
      expr: <D extends J, C>(field: Field<D, V, C>) =>
        asExpr<boolean, D, C>({
          raw: f => asExprRaw({ [op]: [field.expr().raw(f).get(), operand] }),
        }),
    }
  }
