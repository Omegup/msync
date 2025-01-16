import type { O, Rec, RecHKT } from '../../types'
import { root } from '../field'
import type { Before, FRawStages, RawStages } from '../types'

export const asBefore = <Q extends O, S extends Q, R extends Q, C = unknown>(
  f: FRawStages<Q, S, R, C>,
): RawStages<Before<Q>, Before<S>, Before<R>, C> =>
  f<RecHKT<'before'>>(<T extends O>() => root<Rec<'before', T>>().of('before'))
