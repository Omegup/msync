import type { App, HKT, J, RawObj } from '../../types'
import type {
  AccumulatorRaw,
  Delta,
  DeltaStages,
  RawStages,
  SnapshotStreamF,
  Stream,
  TStages,
} from '../types'

export const asStages = <T, V, C = unknown, M extends number = number>(
  x: readonly RawObj[],
): RawStages<T, V, C, M> => x
export const asAccumulator = <T, V, C = unknown>(x: RawObj) => x as AccumulatorRaw<T, V, C>
export const concatStages = <T, V, W, C, M extends number = number>(
  part1: RawStages<T, V, C, M>,
  part2: RawStages<V, W, C, M>,
): RawStages<T, W, C, M> => {
  return asStages([...part1, ...part2])
}

export const concatDelta = <T extends J, V extends J, W extends J>(
  part1: DeltaStages<T, V>,
  part2: DeltaStages<V, W>,
): DeltaStages<T, W> => ({
  delta: concatStages(part1.delta, part2.delta),
  raw: f => concatStages(part1.raw(f), part2.raw(f)),
})

type Concat<T, V, C, M extends number = number> = {
  with: <W>(extra: RawStages<V, W, C, M>) => Concat<T, W, C, M>
  stages: RawStages<T, V, C, M>
}
type DeltaPipe<F extends HKT<J>, T extends J, G extends HKT<readonly [J, J]>> = {
  with: <V extends J>(map: (a: Stream<F, T, G>) => Stream<F, V, G>) => DeltaPipe<F, V, G>
  then: <V extends J>(next: App<G, [T, V]>) => DeltaPipe<F, V, G>
  get: () => App<F, T>
}

export const pipe = <S extends J, T extends J, F extends HKT<J>, G extends HKT<readonly [J, J]>>(
  stream: SnapshotStreamF<S, F, G>,
  s: App<G, [S, T]>,
  concat: <T extends J, V extends J, W extends J>(
    part1: App<G, [T, V]>,
    part2: App<G, [V, W]>,
  ) => App<G, [T, W]>,
  start = s,
) => {
  const acc: DeltaPipe<F, T, G> = {
    with: map =>
      pipe(
        map(i => stream(concat(s, i))),
        start,
        concat,
      ),
    then: x => pipe(stream, concat(s, x), concat, start),
    get: () => stream(s),
  }
  return acc
}
const concat = <T, V, C = unknown, M extends number = number>(
  stages: RawStages<T, V, C, M>,
): Concat<T, V, C, M> => ({
  with: extra => concat(concatStages(stages, extra)),
  stages,
})

export const link = <T, C = unknown, M extends number = number>(): Concat<T, T, C, M> => ({
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
