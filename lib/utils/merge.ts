import type { App, HKT, I } from '../../types'
import type { Continuation, Exists, IteratorResult, IteratorResultHKT, Working } from '../types'
import { map } from './map-object'

export async function* merge<T>(
  asyncIterators: readonly AsyncIterator<T, unknown, never>[],
): AsyncIterator<T, void, never> {
  const promises = asyncIterators.map(iterator => iterator.next())

  while (promises.length > 0) {
    const { value, index, done } = await Promise.race(
      promises.map((p, index) => p.then(res => ({ ...res, index }))),
    )
    if (done) {
      promises.splice(index, 1)
    } else {
      yield value
      promises[index] = asyncIterators[index].next()
    }
  }
}

type Sources<K extends string, S extends Dom, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<readonly Result[], S[P], Dom[P]>
}

type NestedApp<
  X extends Record<K, unknown>,
  F extends { readonly [P in K]: HKT<X[P]> },
  K extends string,
> = { readonly [P in K]: App<F[P], X[P]> }
interface NestedAppHKT<
  F extends { readonly [P in K]: HKT<Dom[P]> },
  K extends string,
  Dom extends Record<K, unknown>,
> extends HKT<Dom> {
  readonly out: NestedApp<I<Dom, this>, F, K>
}

export const all =
  <
    K extends string,
    Dom extends Record<K, unknown>,
    F extends { readonly [P in K]: HKT<Dom[P]> },
  >(m: { readonly [P in K]: Exists<F[P], Dom[P]> }): Exists<NestedAppHKT<F, K, Dom>, Dom> =>
  consume => {
    const object = Object.fromEntries<{ [P in K]: App<F[P], Dom[P]> }>([])
    Object.entries(m).forEach(([k, v]) => v(x => (object[k] = x)))
    return consume(object)
  }

type SourceResults<K extends string, S extends Record<K, unknown>> = {
  readonly [P in K]: { source: P; value: S[P] } & Working
}[K]

export const mergeItResults = <
  K extends string,
  S extends Dom,
  Result,
  Dom extends Record<K, unknown>,
>(
  sources: Sources<K, S, Result, Dom>,
  isExclusive?: (x: S[K]) => true | undefined,
  working?: PromiseLike<Dom[K]>,
): IteratorResult<readonly Result[], SourceResults<K, S>, SourceResults<K, Dom>> => {
  type Next<S2 extends Dom = S> = SourceResults<K, S2>
  type NDom = Next<Dom>
  const run = (): IteratorResult<readonly Result[], Next, NDom> => {
    const cont: Continuation<readonly Result[], Next, NDom> =
      (prev: Next) =>
      <E>(consume: <N extends NDom>(next: IteratorResult<readonly Result[], N, NDom>) => E): E => {
        const f = <P extends K>({ source, value, work }: SourceResults<P, S>) =>
          sources[source].cont(value)(
            <N extends Dom[P]>(nextResult: IteratorResult<readonly Result[], N, Dom[P]>) => {
              const patched = {
                ...sources,
                ...Object.fromEntries([[source, nextResult]]),
              } as Sources<K, S & Record<P, N>, Result, Dom>
              return consume(mergeItResults(patched, isExclusive, work && nextResult.next))
            },
          )
        return f(prev)
      }

    const promises: readonly PromiseLike<Next<S>>[] = Object.entries(sources).map(([k, v]) =>
      v.next.then((x): Next<S> => ({ source: k, value: x, work: isExclusive?.(x) })),
    )
    // type Iter = { readonly [P in K]: Iterator<readonly Result[], Dom[P]> }
    type Iter = { readonly [P in K]: Exists<IteratorResultHKT<Dom[P], readonly Result[]>, Dom[P]> }
    const next = Promise.race<readonly Next[], 0>(promises)
    return {
      data: Object.entries(sources).flatMap(([, v]) => v.data),
      next: working?.then(() => next) ?? next,
      cont,
      stop: () => mergeIterators(map<K, Sources<K, S, Result, Dom>, Iter>(sources, x => x.stop())),
    }
  }
  return run()
}

export const mergeIterators = <
  K extends string,
  Result,
  Dom extends Record<K, unknown>,
>(iterators: {
  readonly [P in K]: Exists<IteratorResultHKT<Dom[P], readonly Result[]>, Dom[P]>
}) => {
  type IteratorResultHKTs = { readonly [P in K]: IteratorResultHKT<Dom[P], readonly Result[]> }
  type NDom = SourceResults<K, Dom>
  const iterator = all<K, Dom, IteratorResultHKTs>(iterators)
  return <E>(consume: <N extends NDom>(result: IteratorResult<readonly Result[], N, NDom>) => E) =>
    iterator(sources => consume(mergeItResults(sources)))
}
