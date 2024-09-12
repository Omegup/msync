import type { J } from '../../../types'
import type { DeltaStages } from '../../types'
import type { Updater } from '../../update'
import { $set1 } from '../mongo-stages'
import { $setDelta } from './$set-delta'

export const $set = <T extends J, V extends J, C = unknown>(
  updater: Updater<T, T, V, C>,
): DeltaStages<T, V, C> => ({
  delta: $setDelta(updater),
  raw: $set1(updater),
})
