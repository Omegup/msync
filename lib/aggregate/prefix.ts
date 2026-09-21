import type { App, HKT, O2, O3, O, RawObj } from '../../types'
import type { Delta, DeltaStages, FRawStages, RawStages, Stream, TStages } from '../types'
import type { Equal } from '../utils/guard'

type n = number
export const asStages = <Q, T extends Q, V extends Q, C = unknown, M extends n = n>(
  x: readonly RawObj[],
): RawStages<Q, T, V, C, M> => x

export const same = <
  T extends Dom,
  V extends Dom,
  F extends HKT<Dom, Q>,
  Dom = unknown,
  Q = unknown,
  C = unknown,
  M extends n = n,
>(
  _: Equal<Dom, T, V>,
) => asStages<Q, App<F, T>, App<F, V>, C, M>([])

export const concatStages = <Q, T extends Q, V extends Q, W extends Q, C, M extends n = n>(
  part1: RawStages<Q, T, V, C, M>,
  part2: RawStages<Q, V, W, C, M>,
): RawStages<Q, T, W, C, M> => asStages([...part1, ...part2])

export const concatFStages =
  <Q, T extends Q & O, V extends Q & O, W extends Q & O, C, M extends n = n>(
    part1: FRawStages<Q, T, V, C, M>,
    part2: FRawStages<Q, V, W, C, M>,
  ): FRawStages<Q, T, W, C, M> =>
  f =>
    concatStages(part1(f), part2(f))

export const concatDelta = <Q extends O, T extends Q, V extends Q, W extends Q>(
  part1: DeltaStages<Q, T, V>,
  part2: DeltaStages<Q, V, W>,
): DeltaStages<Q, T, W> => ({
  delta: concatStages(part1.delta, part2.delta),
  raw: f => concatStages(part1.raw(f), part2.raw(f)),
})

export type Concat<out Q, in T extends Q, out V extends Q, in out C, in out M extends n = n> = {
  with: <Q2, W extends Q2>(extra: RawStages<Q | Q2, V, W, C, M>) => Concat<Q | Q2, T, W, C, M>
  stages: RawStages<Q, T, V, C, M>
}
type FConcat<out Q, in T extends Q & O, out V extends Q & O, in out C, in out M extends n = n> = {
  with: <Q2, W extends Q2 & O>(extra: FRawStages<Q | Q2, V, W, C, M>) => FConcat<Q | Q2, T, W, C, M>
  stages: FRawStages<Q, T, V, C, M>
}
export type DeltaPipe<Q extends O, T extends Q, F extends HKT<O2>, G extends HKT<O3>> = {
  with: <Q2 extends O, V extends Q2>(
    map: (a: Stream<Q, T, F, G>) => Stream<Q | Q2, V, F, G>,
  ) => DeltaPipe<Q | Q2, V, F, G>
  then: <Q2 extends O, V extends Q2>(next: App<G, [Q2 | T, T, V]>) => DeltaPipe<Q | Q2, V, F, G>
  get: () => App<F, [Q, T]>
}

export const pipe = <Q extends O, S extends Q, T extends Q, F extends HKT<O2>, G extends HKT<O3>>(
  stream: Stream<Q, S, F, G>,
  s: App<G, [Q, S, T]>,
  concat: <Q extends O, T extends Q, V extends Q, W extends Q>(
    part1: App<G, [Q, T, V]>,
    part2: App<G, [Q, V, W]>,
  ) => App<G, [Q, T, W]>,
  empty: <T extends Q>() => App<G, [Q, T, T]>,
) => {
  const acc: DeltaPipe<Q, T, F, G> = {
    with: <Q2 extends O, V extends Q2>(
      map: (a: Stream<Q, T, F, G>) => Stream<Q | Q2, V, F, G>,
    ): DeltaPipe<Q | Q2, V, F, G> =>
      pipe<Q | Q2, V, V, F, G>(
        map(i => stream(concat(s, i))),
        empty(),
        concat,
        empty,
      ),
    then: <Q2 extends O, V extends Q2>(next: App<G, [T | Q2, T, V]>): DeltaPipe<Q | Q2, V, F, G> =>
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
const fconcat = <Q, T extends Q & O, V extends Q & O, C = unknown, M extends n = n>(
  stages: FRawStages<Q, T, V, C, M>,
): FConcat<Q, T, V, C, M> => ({
  with: extra => fconcat(concatFStages(stages, extra)),
  stages,
})

type Link = <T, C = unknown, M extends n = n>() => Concat<T, T, T, C, M>
type FLink = <T extends O, C = unknown, M extends n = n>() => FConcat<T, T, T, C, M>

export const link: Link = () => ({
  with: extra => concat(extra),
  stages: asStages([]),
})

export const flink: FLink = () => ({
  with: extra => fconcat(extra),
  stages: () => asStages([]),
})

export const emptyDelta = <T extends O>() => ({
  delta: link<Delta<T>>().stages,
  raw: <F extends HKT<O>>() => link<App<F, T>>().stages,
})

export const concatTStages = <S, Q, B extends Q, T extends Q, V extends Q>(
  { coll, exec, input }: TStages<S, Q, B, T>,
  stages: RawStages<Q, T, V>,
): TStages<S, Q, B, V> => ({ coll, input, exec: concatStages(exec, stages) })
