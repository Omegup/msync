import type { doc } from '../../../types'
import { root } from '../../field'
import { $ne } from '../../predicate'
import { $or } from '../../query/logic'
import type { Delta, Query } from '../../types'
import { $match_ } from '../mongo-stages'
import { concatStages } from '../prefix'
import { deltaDocs } from '../set/$set-delta'

export const $matchDelta = <T extends doc>(query: Query<T>) =>
  concatStages<unknown, Delta<T>, Delta<T | null>, Delta<T>, unknown>(
    deltaDocs($match_(query)),
    $match_(
      $or(
        root<Delta<T>>().of('after').has($ne<T | null>(null)),
        root<Delta<T>>().of('before').has($ne<T | null>(null)),
      ),
    ),
  )
