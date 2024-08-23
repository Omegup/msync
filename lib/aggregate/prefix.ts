import type { HKT, JsonObj } from '../../types'
import type { RawStagesPart, RawStagesSource, Stream } from '../types'

export const fromStages =
  <T extends JsonObj, V extends JsonObj>(stages: RawStagesPart<T, V>) =>
  <F extends HKT<JsonObj>>(source: Stream<T, F>): Stream<V, F> =>
  input =>
    source(concatParts(stages, input))

export const asRawPart = <T, V>(x: readonly JsonObj[]): RawStagesPart<T, V> => x
export const concatParts = <T, V, W>(
  part1: RawStagesPart<T, V>,
  part2: RawStagesPart<V, W>,
): RawStagesPart<T, W> => asRawPart([...part1, ...part2])
export const concatStages = <S, T, V>(
  { coll, stages }: RawStagesSource<S, T>,
  newStages: RawStagesPart<T, V>,
): RawStagesSource<S, V> => ({ coll, stages: concatParts(stages, newStages) })
