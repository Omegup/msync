import type { doc } from '../../../types'
import { ite, ne } from '../../expression/logic'
import { nil } from '../../expression/val'
import { root } from '../../field'
import { $expr } from '../../predicate'
import type { BA, Delta, Expr, RawStages } from '../../types'
import { $match_ } from '../mongo-stages'
import { concatStages } from '../prefix'
import { $replaceWithDelta } from '../set/$set-delta'

export const $matchDelta = <T extends doc>(query: Expr<boolean, T>) =>
  concatStages<unknown, Delta<T>, Delta<T | null>, Delta<T>, unknown>(
    $replaceWithDelta(ite(query, root<T>().expr(), nil)),
    matchDelta(),
  )
export const matchDelta = <D>() => {
  const part = (side: BA) => root<Delta<D | null>>().of(side).expr()
  return $match_<Delta<D | null>>(
    $expr<Delta<D | null>, unknown>(
      ne<D | null, Delta<D | null>, unknown>(part('before'))(part('after')),
    ),
  ) as RawStages<unknown, Delta<D | null>, Delta<D>>
}
