import type { App, ArrHKT, HKT, I, IdHKT } from '../../types'
import type { Continuation, Exists, Iterator, IteratorResult } from '../types'
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
  [P in K]: IteratorResult<readonly Result[], S[P], Dom[P]>
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

export const all2 =
  <
    K extends string,
    Dom extends Record<K, unknown>,
    F extends { readonly [P in K]: HKT<Dom[P]> },
  >(m: { readonly [P in K]: Exists<F[P], Dom[P]> }): Exists<NestedAppHKT<F, K, Dom>, Dom> =>
  consume => {
    const entries = Object.entries(m)

    return consume()
  }

interface F1 extends HKT<unknown> {
  readonly out: [value: I<unknown, this>, next: (x: I<unknown, this>) => I<unknown, this>]
}

type TagOf<S extends string> = S extends unknown
  ? {} extends Record<S, 0>
    ? never
    : `<${S}>ok</${S}>`
  : never

interface TagHKT extends HKT<string> {
  readonly out: TagOf<I<string, this>>
}

type Tag = Exists<TagHKT, string>

const eefe: TagOf<'a'> = '<a>ok</a>'
const eefe2: Exists<TagHKT, string> = c => c('<b>ok</b>')

const aTag: Tag = c => c('<a>ok</a>')
const spanTag: Tag = c => c('<span>ok</span>')

const plusOne: Exists<F1> = c => c([4, x => x ** 2])

type ApplyF1AndF2 = NestedAppHKT<{ a: F1; b: TagHKT }, 'a' | 'b', { a: unknown; b: string }>

type DD = App<ApplyF1AndF2, { a: unknown; b: 'hello' }>

type Args = { a: Exists<F1>; b: Tag }

type AB = { a: unknown; b: string }

type DZDZ<T extends AB> = { a: App<F1, T['a']>; b: App<TagHKT, T['b']> }
interface ABHKT extends HKT<AB> {
  readonly out: DZDZ<I<AB, this>>
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

const args: Args = { a: plusOne, b: aTag }
const result: Exists<ABHKT, AB> = c =>
  c<{ a: number; b: 'span' }>({ a: [5, x => x ** 2], b: '<span>ok</span>' })
const result2 = all<'a' | 'b', AB, { a: F1; b: TagHKT }>(args)

const main = () => {
  plusOne(([x, f]) => {
    aTag(s => {
      console.log(f(f(f(x))))
      console.log(s)
    })
  })

  result(({ a: [x, f], b: s }) => {
    console.log(f(f(f(x))))
    console.log(s)
  })
}

const p1 = Promise.resolve({ a: 1 }),
  p2 = Promise.resolve({ b: 'd' })
p1.then(x => {
  p2.then(y => {
    x.a + y.b
  })
})
Promise.all([p1, p2]).then(([x, y]) => {
  x.a + y.b
})

type SourceResults<K extends string, S extends Record<K, unknown>> = {
  readonly [P in K]: { source: P; value: S[P] }
}[K]

export const mergeIt = <K extends string, S extends Dom, Result, Dom extends Record<K, unknown>>(
  sources: Sources<K, S, Result, Dom>,
): IteratorResult<readonly Result[], SourceResults<K, S>, SourceResults<K, Dom>> => {
  type Next<S2 extends Dom = S> = SourceResults<K, S2>
  type NDom = Next<Dom>
  const run = (): IteratorResult<readonly Result[], Next, NDom> => {
    const cont: Continuation<readonly Result[], Next, NDom> =
      (prev: Next) =>
      <E>(consume: <N extends NDom>(next: IteratorResult<readonly Result[], N, NDom>) => E): E => {
        const f = <P extends K>({ source, value }: { source: P; value: S[P] }) =>
          sources[source].cont(value)(
            <N extends Dom[P]>(next: IteratorResult<readonly Result[], N, Dom[P]>) => {
              const patched = {
                ...sources,
                ...Object.fromEntries([[source, next]]),
              } as Sources<K, S & Record<P, N>, Result, Dom>
              return consume(mergeIt(patched))
            },
          )
        return f(prev)
      }

    const promises: readonly PromiseLike<Next<S>>[] = Object.entries(sources).map(([k, v]) =>
      v.next.then((x): Next<S> => ({ source: k, value: x })),
    )
    return {
      data: Object.entries(sources).flatMap(([, v]) => v.data),
      next: Promise.race<readonly Next[], 0>(promises),
      cont,
      stop: () => {
        type Iter = { readonly [P in K]: Iterator<readonly Result[], Dom[P]> }
        const newIterators = map<K, Sources<K, S, Result, Dom>, Iter>(sources, x => x.stop())
        return <E>(
          consume: <N extends NDom>(result: IteratorResult<readonly Result[], N, NDom>) => E,
        ) => {
          const newIterat = map<K, Iter, Sources<K, S, Result, Dom>>(
            newIterators,
            <P extends K>(
              startWith: Iterator<readonly Result[], Dom[P]>,
            ): IteratorResult<readonly Result[], S[P], Dom[P]> => {
              return startWith<IteratorResult<readonly Result[], S[P], Dom[P]>>(
                <N extends Dom[P]>(result: IteratorResult<readonly Result[], N, Dom[P]>) => {
                  return 0 as {} as IteratorResult<readonly Result[], S[P], Dom[P]>
                },
              )
            },
          )
          // const sss: Sources<K, S, Result, Dom> = 0
          return consume(mergeIt(newIterat))
        }
      },
    }
  }
  return run()
}
