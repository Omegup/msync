import type { J, Rec, RecHKT } from '../../types'
import { root } from '../field'
import type { FRawStages } from '../types'

export const asBefore = <Q extends J, S extends Q, R extends Q, C = unknown>(
  f: FRawStages<Q, S, R, C>,
) => f<RecHKT<'before', J>>(<T extends J>() => root<Rec<'before', T>>().of('before'))
