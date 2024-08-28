import type { App, HKT, I, JsonObj, Rec, WriteonlyCollection, jsonItem } from '../../types'
import { eqTyped, ite } from '../expression/logic'
import { val } from '../expression/val'
import { root, type Field } from '../field'
import type { Delta, Expr, Query, RawStagesPart, RawStagesSource } from '../types'
import { id } from '../utils/json'
import { asRawPart } from './prefix'

export const $matchRaw = <T extends JsonObj>(query: Query<T>) =>
  asRawPart<T, T>([{ $match: query.raw(id) }])

export const $deltaMatchRaw = <T extends JsonObj>(
  query: Query<T>,
): RawStagesPart<Delta<T>, Delta<T>> => {
  type Update = Expr<T | null, Delta<T>, unknown>
  const f = <K extends 'before' | 'after'>(field: K): Update => {
    interface F extends HKT<jsonItem> {
      readonly out: Readonly<Record<K, I<jsonItem, this>>> & Delta<T>
    }
    const subField = root<App<F, T>>().of(field)
    const nullExpr: Expr<null, App<F, T | null>, unknown> = val(() => null)
    return ite<T | null, null, T, F>(
      eqTyped<null, T, F, unknown>(root<Delta<T>>().of(field), nullExpr),
      nullExpr,
      ite(query.expr(subField), subField, nullExpr),
    )
  }
  return asRawPart<Delta<T>, Delta<T>>([
    { $set: { after: f('after').raw(), before: f('before').raw() } },
  ])
}
export const $projectRaw = <T>(projection: Record<keyof T, 1>) =>
  asRawPart<T, T>([{ $project: projection }])

export const $simpleMergeRaw = <T>(out: WriteonlyCollection<T>) =>
  asRawPart<T, never>([{ $merge: out.collectionName }])

export const $lookupRaw = <
  T extends JsonObj,
  U extends JsonObj,
  R,
  S,
  K1 extends string,
  K2 extends string,
>(
  { field2, field1 }: { field2: Field<U, S>; field1: Field<T, S> },
  { stages, coll }: RawStagesSource<R, U>,
  k1: K1,
  k2: K2,
) =>
  asRawPart<T, Record<K1, T> & Record<K2, U>>([
    {
      $replaceWith: { [k1]: '$ROOT' },
    },
    {
      $lookup: {
        from: coll.collectionName,
        as: k2,
        let: { local: root<Rec<K1, T>>().of(k1).of(field1).raw() },
        pipeline: [{ $match: { $expr: { $eq: ['$$local', field2.raw()] } } }, ...stages],
      },
    },
    { $unwind: `$${k2}` },
  ])
