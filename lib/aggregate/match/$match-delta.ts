import type { J } from '../../../types'
import { ite } from '../../expression/logic'
import { nil } from '../../expression/val'
import { root } from '../../field'
import { $ne } from '../../predicate'
import { $or } from '../../query/logic'
import type { Delta, Query, RawStages } from '../../types'
import { $match_ } from '../mongo-stages'
import { concatStages } from '../prefix'
import { $replaceWithDelta } from '../set'

export const $matchDelta = <T extends J>(query: Query<T>): RawStages<Delta<T>, Delta<T>> => {
  return concatStages(
    $replaceWithDelta(ite(query.expr, root<T>().expr(), nil)),
    $match_(
      $or(
        root<Delta<T>>().of('after').has($ne<T | null>(null)),
        root<Delta<T>>().of('before').has($ne<T | null>(null)),
      ),
    ),
  )
}
