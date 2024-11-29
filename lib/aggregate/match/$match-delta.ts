import type { doc } from '../../../types'
import { ite } from '../../expression/logic'
import { nil } from '../../expression/val'
import { root } from '../../field'
import { $ne } from '../../predicate'
import { $or } from '../../query/logic'
import type { Delta, Expr } from '../../types'
import { $match_ } from '../mongo-stages'
import { concatStages } from '../prefix'
import { $replaceWithDelta } from '../set/$set-delta'

export const $matchDelta = <T extends doc>(query: Expr<boolean, T>) =>
  concatStages<unknown, Delta<T>, Delta<T | null>, Delta<T>, unknown>(
    $replaceWithDelta(ite(query, root<T>().expr(), nil)),
    $match_(
      $or(
        root<Delta<T>>().of('after').has($ne<T | null>(null)),
        root<Delta<T>>().of('before').has($ne<T | null>(null)),
      ),
    ),
  )
