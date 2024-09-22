import type { App, HKT, J, Rec, RecHKT } from '../../types'
import { root, type Field } from '../field'
import type { RawStages } from '../types'

export const asBefore = <Q extends J, S extends Q, R extends Q, C = unknown>(
  f: <F extends HKT<J, J>>(
    f: <T extends J>() => Field<App<F, T>, T>,
  ) => RawStages<App<F, Q>, App<F, S>, App<F, R>, C>,
) => f<RecHKT<'before', J>>(<T extends J>() => root<Rec<'before', T>>().of('before'))
