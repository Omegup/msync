import type { App, Arr, ID, O, RORec, Rec, doc, jsonItem } from '../../../types'
import { $push } from '../../accumulators'
import { $array, $filterDefined, $first, $last } from '../../expression/array'
import { field } from '../../expression/concat'
import { ite, sub } from '../../expression/logic'
import { nil, val } from '../../expression/val'
import { ctx, root } from '../../field'
import type { BA, Delta, Expr, RawStages } from '../../types'
import { type Updater } from '../../update'
import { $documents_, $group_, $replaceWith_, $set_, $simpleLookup_ } from '../mongo-stages'
import { link } from '../prefix'
import { $replaceWithEach, type ParDeltaHKT } from './$replace-with-each'

export const $replaceWithDelta = <T extends O, V extends jsonItem>(expr: Expr<V, T>) =>
  $replaceWithEach<T, V, unknown>(<K extends BA>(field: K) =>
    sub(expr, root<App<ParDeltaHKT<K, T, unknown>, T>>().of(field)),
  )

export const deltaDocs = <T extends O, V extends doc, C = unknown>(
  stage: RawStages<unknown, T, V, RORec<'a' | 'b', T | null> & C>,
) => {
  type Ctx = RORec<'a' | 'b', T | null>
  const docs = root<Rec<'docs', Arr<V>>>().of('docs')
  return link<Delta<T>, C>()
    .with<unknown, Rec<'root', Arr<Delta<V> & ID>>>(
      $simpleLookup_<Delta<T>, Delta<V> & ID, never, 'root', Ctx, C>({
        k: 'root',
        vars: {
          a: ['a', root<Delta<T>>().of('after').expr()],
          b: ['b', root<Delta<T>>().of('before').expr()],
        },
        pipeline: link<null, Ctx & C>()
          .with<unknown, T>(
            $documents_(
              $filterDefined<T, unknown, Ctx>(
                $array<T | null, unknown, Ctx>(
                  ctx<T | null>()('a').expr(),
                  ctx<T | null>()('b').expr(),
                ),
              ),
            ),
          )
          .with<unknown, V>(stage)
          .with<unknown, O & { readonly _id: string; readonly docs: Arr<V> }>(
            $group_<Rec<'docs', Arr<V>>>()<'', V>(val(''), {
              docs: ['docs', $push(root<V>().expr())],
            }),
          )
          .with<unknown, Delta<V> & ID>(
            $replaceWith_<O & { readonly _id: string; readonly docs: Arr<V> }, Delta<V> & ID, Ctx>(
              field({
                after: ['after', ite(ctx<T | null>()('a').expr(), $first(docs.expr()), nil)],
                before: ['before', ite(ctx<T | null>()('b').expr(), $last(docs.expr()), nil)],
                _id: [
                  '_id',
                  $first(docs.of<V, '_id', 0>('_id').expr()) as Expr<string, Rec<'docs', Arr<V>>>,
                ],
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
export const $setDelta = <T extends O, V extends doc, C = unknown>(
  updater: Updater<T, T, V, C>,
): RawStages<unknown, Delta<T>, Delta<V>, C> => deltaDocs($set_(updater))
