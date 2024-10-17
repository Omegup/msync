import {
  type App,
  type Arr,
  type ID,
  type J,
  type O,
  type Rec,
  type doc,
  type jsonItem
} from '../../../types'
import { $push } from '../../accumulators'
import { $array, $filter, $first, $last } from '../../expression/array'
import { field } from '../../expression/concat'
import { ite, sub } from '../../expression/logic'
import { val } from '../../expression/val'
import { ctx, root } from '../../field'
import type { BA, Delta, Expr, RawStages } from '../../types'
import { type Updater } from '../../update'
import { $documents_, $group_, $replaceWith_, $set_, $simpleLookup_ } from '../mongo-stages'
import { link } from '../prefix'
import { $replaceWithEach, type ParDeltaHKT } from './$replace-with-each'

export const $replaceWithDelta = <T extends J, V extends jsonItem>(expr: Expr<V, T>) =>
  $replaceWithEach<T, V, unknown>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )

export const $setDelta = <T extends doc, V extends doc, C = unknown>(
  updater: Updater<T, T, V, C>,
): RawStages<unknown, Delta<T>, Delta<V>, C> => {
  type Ctx = { a: T | null; b: T | null }
  return link<Delta<T>, C>()
    .with<unknown, Rec<'root', Arr<Delta<V> & ID>>>(
      $simpleLookup_<Delta<T>, Delta<V> & ID, never, 'root', Ctx, C>({
        k: 'root',
        vars: {
          a: root<Delta<T>>().of('after').expr(),
          b: root<Delta<T>>().of('before').expr(),
        },
        pipeline: link<null, Ctx & C>()
          .with<unknown, T>(
            $documents_(
              $filter<T | null, unknown, 'x', Ctx>({
                as: 'x',
                cond: ctx()('x').expr(),
                expr: $array<T | null, unknown, Ctx>(
                  ctx<T | null>()('a').expr(),
                  ctx<T | null>()('b').expr(),
                ),
              }) as Expr<Arr<T>, unknown, Ctx>,
            ),
          )
          .with<unknown, V>($set_(updater))
          .with<unknown, O & { readonly _id: string; readonly docs: Arr<V> }>(
            $group_<V>()(val(''), { docs: $push(root<V>().expr()) }),
          )
          .with<unknown, Delta<V> & ID>(
            $replaceWith_<O & { readonly _id: string; readonly docs: Arr<V> }, Delta<V> & ID, Ctx>(
              field({
                after: ite(
                  ctx<T | null>()('a').expr(),
                  $first(root<Rec<'docs', Arr<V>>>().of('docs').expr()),
                  val(null),
                ),
                before: ite(
                  ctx<T | null>()('b').expr(),
                  $last(root<Rec<'docs', Arr<V>>>().of('docs').expr()),
                  val(null),
                ),
                _id: $first(root<Rec<'docs', Arr<V>>>().of('docs').of('_id').expr()) as Expr<
                  string,
                  Rec<'docs', Arr<V>>
                >,
              }),
            ),
          ).stages,
      }),
    )
    .with<unknown, Delta<V> & ID>(
      $replaceWith_(
        $first<Delta<V> & ID, Rec<'root', Arr<Delta<V> & ID>>, C>(
          root<Rec<'root', Arr<Delta<V> & ID>>>().of('root').expr(),
        ) as Expr<Delta<V> & ID, Rec<'root', Arr<Delta<V> & ID>>>,
      ),
    ).stages
}
