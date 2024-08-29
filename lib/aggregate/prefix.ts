import type { HKT, JsonObj, RawObj } from '../../types'
import type { RawStages, TStages, Stream } from '../types'

export const fromStages =
  <T extends JsonObj, V extends JsonObj>(stages: RawStages<T, V>) =>
  <F extends HKT<JsonObj>>(source: Stream<T, F>): Stream<V, F> =>
  input =>
    source(concatStages(stages, input))

export const asStages = <T, V, C = unknown>(x: readonly RawObj[]): RawStages<T, V, C> => x
export const concatStages = <T, V, W>(
  part1: RawStages<T, V>,
  part2: RawStages<V, W>,
): RawStages<T, W> => asStages([...part1, ...part2])

type Concat<T, V> = {
  with: <W>(extra: RawStages<V, W>) => Concat<T, W>
  stages: RawStages<T, V>
}

export const concat = <T, V>(stages: RawStages<T, V>): Concat<T, V> => ({
  with: extra => concat(concatStages(stages, extra)),
  stages,
})

export const concatTStages = <S, T, V>(
  { coll, stages }: TStages<S, T>,
  newStages: RawStages<T, V>,
): TStages<S, V> => ({ coll, stages: concatStages(stages, newStages) })
