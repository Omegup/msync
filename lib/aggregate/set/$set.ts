import type { App, doc, Literal, HKT, I, ID, O, RemoveSignature, StrKey } from '../../../types'
import type { DeltaStages, Expr, LinStages } from '../../types'
import { set, type Updater, type UpdaterHKT } from '../../update'
import { doubleExclude, renamedFields, type Equal } from '../../utils/guard'
import type { MapK } from '../../utils/map-object'
import { $replaceWith1, $replaceWith_, $set1, $set_ } from '../mongo-stages'
import { $replaceWithDelta, $setDelta } from './$set-delta'

const $setCore = <Q, T extends Q & O, V extends Q & ID & O, C = unknown>(
  updater: Updater<T, T, V, C>,
): DeltaStages<Q, T, V, C> & LinStages<Q, T, V, C> => ({
  delta: $setDelta(updater),
  raw: $set1<Q, T, V, C>(updater),
  lin: $set_(updater),
})

type RmId<V> = Omit<RemoveSignature<V>, '_id'> & O
export type Replace<R, V, W = RmId<V>> = Omit<R, StrKey<W>> & W & ID
export const $set =
  <V extends O>() =>
  <R extends doc, C = unknown>(
    fields: MapK<StrKey<RmId<V>>, UpdaterHKT<R, R, RmId<V>, C>>,
  ): DeltaStages<O, R, Replace<R, V>, C> & LinStages<O, R, Replace<R, V>, C> => {
    type W = RmId<V>
    type s = keyof any
    type K = keyof RemoveSignature<V>
    interface LiteralF extends HKT<s> {
      readonly out: Literal<I<s, this>>
    }
    interface GetF<T> extends HKT<keyof T> {
      readonly out: T[I<keyof T, this>]
    }
    const renamed: Equal<s, K, Literal<keyof V>> = renamedFields<keyof V, LiteralF, GetF<V>>()
    type UpdaterT<T> = Updater<R, R, Omit<R, StrKey<W>> & W & T, C>

    interface PickF extends HKT<'_id'> {
      readonly out: UpdaterT<Pick<ID, I<'_id', this>>>
    }
    interface ExcludeF extends HKT<s> {
      readonly out: App<PickF, Exclude<'_id', string & Exclude<I<s, this>, keyof ID>>>
    }
    return $setCore<O, R, Replace<R, V>, C>(
      doubleExclude<'_id', string, keyof V>().backward<PickF>(
        renamed.forward<ExcludeF>(set<RmId<V>>()(fields)),
      ),
    )
  }

export const $replaceWith = <T extends O, V extends O>(
  expr: Expr<V, T>,
): DeltaStages<O, T, V> & LinStages<O, T, V> => ({
  delta: $replaceWithDelta(expr),
  raw: $replaceWith1(expr),
  lin: $replaceWith_(expr),
})
