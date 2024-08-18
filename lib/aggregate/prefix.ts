import type { HKT, JsonObj } from '../../types'
import type { RawStages, RawStagesPart, StagesMapper, Stream } from '../types'

export const fromStages =
  <T extends JsonObj, V extends JsonObj>(stages: RawStagesPart<T, V>) =>
  <F extends HKT<JsonObj>>(source: Stream<T, F>): Stream<V, F> =>
  input =>
    source(concatParts(stages, input))

export const asRowPart = <T, V>(x: readonly JsonObj[]): RawStagesPart<T, V> => x
export const concatParts = <T, V, W>(
  part1: RawStagesPart<T, V>,
  part2: RawStagesPart<V, W>,
): RawStagesPart<T, W> => asRowPart([...part1, ...part2])
export const concatStages =
  <T, V>(input: RawStages<T>, newStages: RawStagesPart<T, V>): RawStages<V> =>
  consume =>
    consume(
      input(({ coll, stages }) => {
        return { coll, stages: concatParts(stages, newStages) }
      }),
    )

export const appendStages =
  <T, V, Param>(stages: RawStagesPart<T, V>): StagesMapper<T, V, Param> =>
  previousStages => ({
    get: (param): RawStages<V> => concatStages(previousStages.get(param), stages),
    default: previousStages.default,
  })
