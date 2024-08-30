import type { HKT, JsonObj, RawObj } from '../../types'
import type { RawStages, TStages, Stream } from '../types'

export const fromStages =
  <T extends JsonObj, V extends JsonObj>(stages: RawStages<T, V>) =>
  <F extends HKT<JsonObj>>(source: Stream<T, F>): Stream<V, F> =>
  input =>
    source(concatStages(stages, input))

export const asStages = <T, V, C = unknown>(x: readonly RawObj[]): RawStages<T, V, C> => x
export const concatStages = <T, V, W, C>(
  part1: RawStages<T, V, C>,
  part2: RawStages<V, W, C>,
): RawStages<T, W, C> => asStages([...part1, ...part2])

type Concat<T, V, C> = {
  with: <W>(extra: RawStages<V, W, C>) => Concat<T, W, C>
  stages: RawStages<T, V, C>
}

const concat = <T, V, C = unknown>(stages: RawStages<T, V, C>): Concat<T, V, C> => ({
  with: extra => concat(concatStages(stages, extra)),
  stages,
})

export const link = <T, C = unknown>(): Concat<T, T, C> => ({
  with: extra => concat(extra),
  stages: asStages([]),
})

export const concatTStages = <S, T, V>(
  { coll, stages }: TStages<S, T>,
  newStages: RawStages<T, V>,
): TStages<S, V> => ({ coll, stages: concatStages(stages, newStages) })
