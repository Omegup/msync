import type { Frame, IteratorResult, HasJob } from '../../types'

export type KEYS = string
export type SourceIteratorResults<K extends KEYS, Result, Info extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<Result, Info[P]>
}

export type SourceResults<K extends KEYS, Info extends Record<K, HasJob>> = {
  readonly [P in K]: { readonly key: P; readonly value: Info[P]; readonly job: Info[P]['job'] }
}[K]

export type RaceWinner<K extends KEYS, Result, Info extends Record<K, unknown>> = {
  readonly [P in K]: {
    readonly key: P
    readonly frame: Frame<Result, Info[P]>
  }
}[K]

export type Race<K extends KEYS, Result, Info extends Record<K, HasJob>> = (
  arg: SourceIteratorResults<K, Result, Info>,
) => PromiseLike<RaceWinner<K, Result, Info>>
