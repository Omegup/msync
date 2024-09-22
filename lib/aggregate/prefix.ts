import type { App, HKT, J, RawObj } from '../../types'
import type { Delta, DeltaStages, RawStages, Stream, TStages } from '../types'

type n = number
export const asStages = <Q, T extends Q, V extends Q, C = unknown, M extends n = n>(
  x: readonly RawObj[],
): RawStages<Q, T, V, C, M> => x

export const concatStages = <Q, T extends Q, V extends Q, W extends Q, C, M extends n = n>(
  part1: RawStages<Q, T, V, C, M>,
  part2: RawStages<Q, V, W, C, M>,
): RawStages<Q, T, W, C, M> => {
  return asStages([...part1, ...part2])
}

export const concatDelta = <Q extends J, T extends Q, V extends Q, W extends Q>(
  part1: DeltaStages<Q, T, V>,
  part2: DeltaStages<Q, V, W>,
): DeltaStages<Q, T, W> => ({
  delta: concatStages(part1.delta, part2.delta),
  raw: f => concatStages(part1.raw(f), part2.raw(f)),
})

type Concat<Q, T extends Q, V extends Q, C, M extends n = n> = {
  with: <W extends Q>(extra: RawStages<Q, V, W, C, M>) => Concat<Q, T, W, C, M>
  stages: RawStages<Q, T, V, C, M>
}
type DeltaPipe<
  Q extends J,
  T extends Q,
  F extends HKT<readonly [J, J]>,
  G extends HKT<readonly [J, J, J]>,
> = {
  with: <Q2 extends J, V extends Q2>(
    map: (a: Stream<Q, T, F, G>) => Stream<Q | Q2, V, F, G>,
  ) => DeltaPipe<Q | Q2, V, F, G>
  then: <Q2 extends J, V extends Q2>(next: App<G, [Q2 | T, T, V]>) => DeltaPipe<Q | Q2, V, F, G>
  get: () => App<F, [Q, T]>
}

export const pipe = <
  Q extends J,
  S extends Q,
  T extends Q,
  F extends HKT<readonly [J, J]>,
  G extends HKT<readonly [J, J, J]>,
>(
  stream: Stream<Q, S, F, G>,
  s: App<G, [Q, S, T]>,
  concat: <Q extends J, T extends Q, V extends Q, W extends Q>(
    part1: App<G, [Q, T, V]>,
    part2: App<G, [Q, V, W]>,
  ) => App<G, [Q, T, W]>,
  empty: <T extends Q>() => App<G, [Q, T, T]>,
) => {
  const acc: DeltaPipe<Q, T, F, G> = {
    with: <Q2 extends J, V extends Q2>(
      map: (a: Stream<Q, T, F, G>) => Stream<Q | Q2, V, F, G>,
    ): DeltaPipe<Q | Q2, V, F, G> =>
      pipe<Q | Q2, V, V, F, G>(
        map(i => stream(concat(s, i))),
        empty(),
        concat,
        empty,
      ),
    then: <Q2 extends J, V extends Q2>(next: App<G, [T | Q2, T, V]>): DeltaPipe<Q | Q2, V, F, G> =>
      pipe<Q | Q2, S, V, F, G>(stream, concat(s, next), concat, empty),
    get: () => stream(s),
  }
  return acc
}
const concat = <Q, T extends Q, V extends Q, C = unknown, M extends n = n>(
  stages: RawStages<Q, T, V, C, M>,
): Concat<Q, T, V, C, M> => ({
  with: extra => concat(concatStages(stages, extra)),
  stages,
})

type Link = <Q, T extends Q = Q, C = unknown, M extends n = n>() => Concat<Q, T, T, C, M>

export const link: Link = () => ({
  with: extra => concat(extra),
  stages: asStages([]),
})

export const emptyDelta = <T extends J>() => ({
  delta: link<Delta<T>>().stages,
  raw: <F extends HKT<J>>() => link<App<F, T>>().stages,
})

export const concatTStages = <Q, S extends Q, T extends Q, V extends Q>(
  { coll, stages }: TStages<Q, S, T>,
  newStages: RawStages<Q, T, V>,
): TStages<Q, S, V> => ({ coll, stages: concatStages(stages, newStages) })
