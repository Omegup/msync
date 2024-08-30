import type {
  App,
  Arr,
  HKT,
  I,
  JsonObj,
  N,
  RORec,
  ReadonlyCollection,
  Rec,
  WriteonlyCollection,
  doc,
  jsonItem
} from '../../types'
import { field } from '../expression/concat'
import { eq, eqTyped, ite, sub } from '../expression/logic'
import { val } from '../expression/val'
import { root, type Field } from '../field'
import { $ne } from '../predicate'
import { $expr } from '../predicate/$expr'
import { $or } from '../query/logic'
import type { Before, Delta, Expr, Query, RawStages, TStages } from '../types'
import { set, to, type Updater } from '../update'
import { asStages, concatStages, link } from './prefix'

type s = string
type J = JsonObj

export const $match_ = <T extends J, C = unknown>(query?: Query<T, C>) =>
  asStages<T, T, C>(query ? [{ $match: query.raw(root()) }] : [])

export const $set_ = <T, V, C = unknown>(updater: Updater<T, T, V, C>) =>
  asStages<T, V, C>([{ $set: updater.raw }])

export const $project_ = <T>(projection: Record<keyof T, 1>) =>
  asStages<T, T>([{ $project: projection }])

export const $replaceWith_ = <T extends J, V>(expr: Expr<V, T>) =>
  asStages<T, V>([{ $replaceWith: expr.raw(root()) }])

export const $simpleMerge_ = <T, K extends keyof T>(out: WriteonlyCollection<T>) =>
  asStages<Pick<T, K>, never>([{ $merge: out.collectionName }])

export const $unwind_ = <T, K extends s, U>(k: K): RawStages<T & Rec<K, Arr<U>>, T & Rec<K, U>> =>
  asStages<T & Rec<K, Arr<U>>, T & Rec<K, U>>([{ $unwind: `$${k}` }])

export const $simpleLookup_ = <T extends J, U extends J, R, K extends s, Ctx, C>(args: {
  coll: ReadonlyCollection<R>
  pipeline: RawStages<R, U, Ctx & C>
  vars: { readonly [P in keyof Ctx]: Expr<Ctx[P], T, C> }
  k: K
}) => {
  const { coll, k, pipeline, vars } = args
  return asStages<T, T & Rec<K, Arr<U>>>([
    {
      $lookup: {
        from: coll.collectionName,
        as: k,
        let: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.raw(root())])),
        pipeline,
      },
    },
  ])
}

const deltaExpr =
  <T extends J, V extends jsonItem>(expr: Expr<V, T>) =>
  <K extends 'before' | 'after'>(field: K): Expr<V | null, Delta<T>> => {
    interface F extends HKT<jsonItem> {
      readonly out: Readonly<Record<K, I<jsonItem, this>>> & Delta<T>
    }
    const subField = root<App<F, T>>().of(field)
    const nullExpr: Expr<null, App<F, T | null>, unknown> = val(() => null)
    return ite<V | null, null, T, F>(
      eqTyped<null, T, F, unknown>(root<Delta<T>>().of(field), nullExpr),
      nullExpr,
      sub(expr, subField),
    )
  }

export const $replaceWithDelta = <T extends J, V extends jsonItem>(expr: Expr<V, T>) => {
  const t = deltaExpr(expr)
  return $set_<Delta<T>, Delta<V>>(
    set({
      after: to(t('after')),
      before: to(t('before')),
    }),
  )
}

export const $matchDelta = <T extends J>(query: Query<T>): RawStages<Delta<T>, Delta<T>> => {
  const nullExpr = val(() => null)
  return concatStages(
    $replaceWithDelta(ite(query.expr, root(), nullExpr)),
    $match_(
      $or(
        root<Delta<T>>().of('after').has($ne<T | null>(null)),
        root<Delta<T>>().of('before').has($ne<T | null>(null)),
      ),
    ),
  )
}

export const ctx = <K extends s, V>(k: K): Expr<V, unknown, RORec<K, V>> => ({
  raw: () => `$$${k}`,
})

export const $unwindDelta = <T, K extends s, U>(
  k: K,
): RawStages<Delta<T & Rec<K, Arr<U>>>, Delta<T & Rec<K, U>>> =>
  asStages<T & Rec<K, Arr<U>>, T & Rec<K, U>>([{ $unwind: `$${k}` }])

export const $lookupDelta = <T extends J, U extends J, R, S, K1 extends s, K2 extends s>(
  { field2, field1 }: { field2: Field<U, S>; field1: Field<T, S> },
  { stages, coll }: TStages<R, Before<U>>,
  k1: K1,
  k2: K2,
): RawStages<Delta<T>, Delta<Rec<K1, T> & Rec<K2, U>>> => {
  type BU = Before<U>
  const f2 = sub(field2, root<BU>().of('before'))
  return link<Delta<T>>()
    .with<Delta<Rec<K1, T>>>(
      $replaceWithDelta<T, Rec<K1, T>>(
        field(Object.fromEntries<Record<K1, Expr<T, T>>>([[k1, root()]])),
      ),
    )
    .with<Delta<Rec<K1, T>> & Rec<K2, Arr<BU>>>(
      $simpleLookup_({
        coll,
        k: k2,
        vars: { local: root<Delta<Rec<K1, T>>>().of('after').of(k1).of(field1) },
        pipeline: concatStages(
          stages,
          $match_($expr(eq<S | N, BU, { readonly local: S | N }>(ctx('local'))(f2))),
        ),
      }),
    )
    .with<Delta<Rec<K1, T> & Rec<K2, U>>>(0).stages
}

export const $lookupRaw = <T extends doc, U extends doc, R, S, K1 extends s, K2 extends s>(
  { field2, field1 }: { field2: Field<U, S>; field1: Field<T, S> },
  { stages, coll }: TStages<R, U>,
  k1: K1,
  k2: K2,
) =>
  link<T>()
    .with(
      $replaceWith_<T, Rec<K1, T>>(
        field(Object.fromEntries<Record<K1, Expr<T, T>>>([[k1, root()]])),
      ),
    )
    .with(
      $simpleLookup_<Rec<K1, T>, U, R, K2, { readonly local: S }, unknown>({
        coll,
        k: k2,
        vars: { local: root<Rec<K1, T>>().of(k1).of(field1) },
        pipeline: concatStages(
          stages,
          $match_($expr(eq<S, U, { readonly local: S }>(ctx('local'))(field2))),
        ),
      }),
    )
    .with($unwind_<Rec<K1, T>, K2, U>(k2)).stages
