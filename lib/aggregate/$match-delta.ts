import type { JsonObj } from '../../types'
import { ite } from '../expression/logic'
import { val } from '../expression/val'
import { root } from '../field'
import { $ne } from '../predicate'
import { $or } from '../query/logic'
import type { Delta, Query, RawStages } from '../types'
import { $match_ } from './$match-raw'
import { $replaceWithDelta } from './$replace-with-each'
import { concatStages } from './prefix'

export const $matchDelta = <T extends JsonObj>(query: Query<T>): RawStages<Delta<T>, Delta<T>> => {
  const nullExpr = val(() => null)
  return concatStages(
    $replaceWithDelta(ite(query.expr, root(), nullExpr)),
    $match_(
      $or(
        root<Delta<T>>().of('after').has($ne<T | null>(null)),
        root<Delta<T>>().of('before').has($ne<T | null>(null)),
      ),
    ),
  )
}
