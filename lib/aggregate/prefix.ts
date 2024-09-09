import type { App, HKT, I, J, RawObj } from '../../types'
import type {
  Delta,
  DeltaStages,
  RawStages,
  SnapshotStream,
  SnapshotStreamExecutionResult,
  Stream,
  TStages
} from '../types'

export const asStages = <T, V, C = unknown>(x: readonly RawObj[]): RawStages<T, V, C> => x
export const concatStages = <T, V, W, C>(
  part1: RawStages<T, V, C>,
  part2: RawStages<V, W, C>,
): RawStages<T, W, C> => asStages([...part1, ...part2])

export const concatDelta = <T extends J, V extends J, W extends J>(
  part1: DeltaStages<T, V>,
  part2: DeltaStages<V, W>,
): DeltaStages<T, W> => ({
  delta: concatStages(part1.delta, part2.delta),
  raw: f => concatStages(part1.raw(f), part2.raw(f)),
})

type Concat<T, V, C> = {
  with: <W>(extra: RawStages<V, W, C>) => Concat<T, W, C>
  stages: RawStages<T, V, C>
}
type DeltaPipe<G extends HKT<J>, T extends J> = {
  with: <V extends J>(map: (a: Stream<G, T>) => Stream<G, V>) => DeltaPipe<G, V>
  then: <V extends J>(next: DeltaStages<T, V>) => DeltaPipe<G, V>
  get: () => App<G, T>
}

interface SnapshotStreamHKT extends HKT<J> {
  readonly out: SnapshotStreamExecutionResult<I<J, this>>
}

export const pipe = <S extends J, T extends J>(stream: SnapshotStream<S>, s: DeltaStages<S, T>) => {
  const acc: DeltaPipe<SnapshotStreamHKT, T> = {
    with: map =>
      pipe(
        map(i => stream(concatDelta(s, i))),
        emptyDelta(),
      ),
    then: x =>
      pipe(stream, {
        delta: concatStages(s.delta, x.delta),
        raw: f => concatStages(s.raw(f), x.raw(f)),
      }),
    get: () => stream(s),
  }
  return acc
}
const concat = <T, V, C = unknown>(stages: RawStages<T, V, C>): Concat<T, V, C> => ({
  with: extra => concat(concatStages(stages, extra)),
  stages,
})

export const link = <T, C = unknown>(): Concat<T, T, C> => ({
  with: extra => concat(extra),
  stages: asStages([]),
})

export const emptyDelta = <T extends J>() => ({
  delta: link<Delta<T>>().stages,
  raw: <F extends HKT<J>>() => link<App<F, T>>().stages,
})

export const concatTStages = <S, T, V>(
  { coll, stages }: TStages<S, T>,
  newStages: RawStages<T, V>,
): TStages<S, V> => ({ coll, stages: concatStages(stages, newStages) })
