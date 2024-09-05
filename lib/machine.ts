import type { AppMap, HKT, I, PromiseHKT, µ } from "../types";
import type { AsNum, GetDom } from "../types/global";
import type { Machine, RunnerSource } from "./types";
import { splitAsyncIterator } from "./utils/async-iter";


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
interface MachineHKT<Dom = unknown> extends HKT<Dom> {
  readonly out: Machine<I<Dom, this>>
}

/** @TODO each iteration run runner then check for restart request then run all children then (check and next)* */
export const machine = <T, V extends readonly unknown[]>(runner: RunnerSource<T, void>, childrenMachines: AppMap<MachineHKT, V>): Machine<readonly [T, V]> => async function* (restart): AsyncIterator<readonly [T, V], never, void> {
  const [childrenPipe, restartChildren] = splitAsyncIterator<void>()
  const children = childrenMachines.map<V, MachineHKT, µ<[GetHKT, AsyncIteratorHKT], GetDom>>(child => child(childrenPipe))
  let restartReceived = true, restartPromise!: Promise<unknown>
  let first = true
  while (true) {
    // consume restart next promises
    if (restartReceived) {
      restartReceived = false
      restartPromise = restart.next()
      restartPromise.then(() => restartReceived = true)
    }
    let initialChildrenData: V | undefined, run = true
    const [data, nextReady] = (await runner.next()).value
    nextReady.then(() => run = false)
    if (!first) restartChildren()
    first = false
    const promises = children.map<V, AsyncIteratorHKT, µ<[IteratorResultHKT, PromiseHKT]>>((child) => child.next())
    const initialChildrenDataPromise = Promise.all<V>(promises.map<V, µ<[IteratorResultHKT, PromiseHKT]>, PromiseHKT>(p => p.then(({ value: v }) => v)))
    initialChildrenDataPromise.then(v => initialChildrenData = v)
    let updatedChildrenData: Partial<V> = {}
    while (run) {
      type OneOfChildren = { [I in keyof V]: readonly [V[I], AsNum<I>]; }[number]
      const oneOfChildrenYields: Promise<OneOfChildren> = Promise.race<{ [I in keyof V]: readonly [V[I], AsNum<I>] }, 0>(
        promises.map<V, µ<[IteratorResultHKT, PromiseHKT]>, µ<[WithIndexHKT, PromiseHKT], GetDom>, 0>((p, index) => p.then(({ value }) => [value, index]))
      )
      const prepareForRace = <T, V>(x: Promise<T>, y: Promise<V>): AppMap<PromiseHKT, readonly [T, V]> => [x, y] as const
      const readyForNextPromise = Promise.race([nextReady, restartPromise])
      const winningPromise = await Promise.race(prepareForRace(
        oneOfChildrenYields.then(content => ({ content, restart: false as const })),
        readyForNextPromise.then(() => ({ restart: true as const }))))
      if (winningPromise.restart) break
      const [value, index] = winningPromise.content
      Object.assign(updatedChildrenData, { [index]: value })
      if (initialChildrenData) {
        initialChildrenData = Object.assign(initialChildrenData, updatedChildrenData)
        updatedChildrenData = {}
        yield [data, initialChildrenData]
      }
      promises[index] = children[index].next();
    }
  }
}
