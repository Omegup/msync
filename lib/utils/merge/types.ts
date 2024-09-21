import type { Frame, IteratorResult, Working } from '../../types'

export type KEYS = string
export type SourceIteratorResults<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<Result, Dom[P]>
}

export type SourceResults<K extends KEYS, Dom extends Record<K, Working>> = {
  readonly [P in K]: { readonly key: P; readonly value: Dom[P]; readonly work: Dom[P]['work'] }
}[K]

export type RaceWinner<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: {
    readonly key: P
    readonly frame: Frame<Result, Dom[P]>
  }
}[K]

export type RaceWinnerAndSources<
  K extends KEYS,
  Result,
  Dom extends Record<K, unknown>,
> = RaceWinner<K, Result, Dom>

export type Race<K extends KEYS, Result, Dom extends Record<K, Working>> = (
  arg: SourceIteratorResults<K, Result, Dom>,
) => PromiseLike<RaceWinnerAndSources<K, Result, Dom>>

export type InfoBuilder = <K extends string, Dom extends Record<K, Working>>(
  key: K,
  info: Dom[K],
) => SourceResults<K, Dom>
