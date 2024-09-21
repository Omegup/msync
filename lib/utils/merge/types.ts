import type { App, HKT } from '../../../types'
import type { Frame, IteratorResult } from '../../types'

export type KEYS = string
export type SourceIteratorResults<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: IteratorResult<Result, Dom[P]>
}

export type FSourceResults<K extends KEYS, W, F extends HKT<W>, Dom extends Record<K, W>> = {
  readonly [P in K]: { readonly key: P; readonly value: Dom[P] } & App<F, Dom[P]>
}[K]

export type RaceWinner<K extends KEYS, Result, Dom extends Record<K, unknown>> = {
  readonly [P in K]: {
    readonly key: P
    readonly frame: Frame<Result, Dom[P]>
  }
}[K]

export type RaceWinnerAndSources<K extends KEYS, Result, Dom extends Record<K, unknown>, WinnerExtra> = {
  readonly winner: RaceWinner<K, Result, Dom> & WinnerExtra
  readonly sources: SourceIteratorResults<K, Result, Dom>
}
export type GRace<W, NextExtra> = <K extends KEYS, Result, Dom extends Record<K, W>>(
  arg: SourceIteratorResults<K, Result, Dom>,
) => PromiseLike<RaceWinnerAndSources<K, Result, Dom, NextExtra>>

export type Race<W, K extends KEYS, Result, Dom extends Record<K, W>, NextExtra> = (
  arg: SourceIteratorResults<K, Result, Dom>,
) => PromiseLike<RaceWinnerAndSources<K, Result, Dom, NextExtra>>

