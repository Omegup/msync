import type { App, HKT, I, JsonObj, WriteonlyCollection } from '../../types'
import { eqTyped, ite } from '../expression/logic'
import { val } from '../expression/val'
import { root, type Field } from '../field'
import type { BoolExpr, Delta, Expr, Query, RawStagesSource } from '../types'
import { id } from '../utils/json'
import { asRawPart } from './prefix'

export const $matchRaw = <T extends JsonObj>(query: Query<T>) =>
  asRawPart<T, T>([{ $match: query.raw(id) }])

export const $deltaMatchRaw = <T extends JsonObj>(query: Query<T>) => {
  type Update = Expr<T | null, Delta<T>, unknown>
  const f = <K extends 'before' | 'after'>(field: K): Update => {
    type DD = K
    const ff: DD = field
    interface F extends HKT {
      readonly out: Readonly<Record<DD, I<unknown, this>>> & Delta<T>
    }
    const subField: Field<App<F, T>, unknown, T> = root<App<F, T>>().of(ff)
    const nullExpr = val(() => null)
    const isFieldNull = eqTyped<null, T, F, unknown>(root<Delta<T>>().of(ff).expr())(nullExpr)
    const ee: Expr<T | null, App<F, T>, unknown> = ite<T | null, App<F, T>, unknown>(query.expr(subField), subField.expr(), nullExpr)
    return ite<T | null, App<F, null>, App<F, T>, unknown>(
      isFieldNull,
      nullExpr,
      ee,
    )
  }
  return asRawPart<Delta<T>, Delta<T>>([
    { $set: { after: f().raw(), before: f().raw() } },
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
        let: { local: `$${k1}.${field1.field}` },
        pipeline: [{ $match: { $expr: { $eq: ['$$local', `$${field2.field}`] } } }, ...stages],
      },
    },
    { $unwind: `$${k2}` },
  ])
