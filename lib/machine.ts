import type { AppMap, HKT, I, PromiseHKT, µ } from '../types'
import type { AsNum, GetDom } from '../types/global'
import type { Runner, RunnerSource } from './types'
import { splitAsyncIterator } from './utils/async-iter'

type Get<I extends GetDom> = I[0][I[1] & keyof I[0]]
interface GetHKT extends HKT<GetDom> {
  readonly out: Get<I<GetDom, this>>
}
interface AsyncIteratorHKT<Dom = unknown, TReturn = never, TNext = void> extends HKT<Dom> {
  readonly out: AsyncIterator<I<Dom, this>, TReturn, TNext>
}
interface IteratorResultHKT<Dom = unknown, TReturn = never> extends HKT<Dom> {
  readonly out: IteratorResult<I<Dom, this>, TReturn>
}
interface WithIndexHKT extends HKT<GetDom> {
  readonly out: readonly [Get<I<GetDom, this>>, AsNum<I<GetDom, this>[1]>]
}

type PairDom = readonly [unknown, unknown]

interface MachineHKT<Dom extends PairDom = PairDom> extends HKT<Dom> {
  readonly out: RunnerSource<I<Dom, this>[0], I<Dom, this>[1]>
}

/** @TODO each iteration run runner then check for restart request then run all children then (check and next)* */
export const machine = async function* <T, S, VS extends readonly PairDom[]>(
  root: RunnerSource<T, S>,
  children: AppMap<MachineHKT, VS, PairDom>,
): RunnerSource<readonly [T, { [K in keyof VS]: VS[K][0] }?], { [K in keyof VS]: readonly [K, VS[K][1]] }[keyof VS]> {


while (true) {
    // consume restart next promises
    const [data, nextReady] = (await root.next()).value
    const dd = yield [[data], s ]
    let initialChildrenData: V | undefined,
      run = true
    nextReady.then(() => (run = false))
    if (!first) restartChildren()
    first = false
    const promises = children.map<V, AsyncIteratorHKT, µ<[IteratorResultHKT, PromiseHKT]>>(child =>
      child.next(),
    )
    const initialChildrenDataPromise = Promise.all<V>(
      promises.map<V, µ<[IteratorResultHKT, PromiseHKT]>, PromiseHKT>(p =>
        p.then(({ value: v }) => v),
      ),
    )
    initialChildrenDataPromise.then(v => (initialChildrenData = v))
    let updatedChildrenData: Partial<V> = {}
    while (run) {
      type OneOfChildren = { [I in keyof VS]: readonly [VS[I][0], AsNum<I>] }[number]
      const oneOfChildrenYields: Promise<OneOfChildren> = Promise.race<
        { [I in keyof V]: readonly [V[I], AsNum<I>] },
        0
      >(
        promises.map<
          V,
          µ<[IteratorResultHKT, PromiseHKT]>,
          µ<[WithIndexHKT, PromiseHKT], GetDom>,
          0
        >((p, index) => p.then(({ value }) => [value, index])),
      )
      const prepareForRace = <T, V>(
        x: Promise<T>,
        y: Promise<V>,
      ): AppMap<PromiseHKT, readonly [T, V]> => [x, y] as const
      const readyForNextPromise = Promise.race([nextReady, restartPromise])
      const winningPromise = await Promise.race(
        prepareForRace(
          oneOfChildrenYields.then(content => ({ content, restart: false as const })),
          readyForNextPromise.then(() => ({ restart: true as const })),
        ),
      )
      if (winningPromise.restart) break
      const [value, index] = winningPromise.content
      Object.assign(updatedChildrenData, { [index]: value })
      if (initialChildrenData) {
        initialChildrenData = Object.assign(initialChildrenData, updatedChildrenData)
        updatedChildrenData = {}
        yield [data, initialChildrenData]
      }
      promises[index] = children[index].next()
    }
  }
}
