import type { Frame, IteratorResult, HasJob } from '../../types'

export type KEYS = string
export type SourceIteratorResults<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<Result, Dom[P]>
}

export type SourceResults<K extends KEYS, Dom extends Record<K, HasJob>> = {
  readonly [P in K]: { readonly key: P; readonly value: Dom[P]; readonly job: Dom[P]['job'] }
}[K]

export type RaceWinner<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: {
    readonly key: P
    readonly frame: Frame<Result, Dom[P]>
  }
}[K]

export type Race<K extends KEYS, Result, Dom extends Record<K, HasJob>> = (
  arg: SourceIteratorResults<K, Result, Dom>,
) => PromiseLike<RaceWinner<K, Result, Dom>>

