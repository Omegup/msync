import type { Arr, AsLiteral, ID, Rec, doc, rawItem } from '../../../types'
import type { BA, Delta, RawStages } from '../../types'
import { $unwind_ } from '../mongo-stages'
import { asStages, link } from '../prefix'

type s = string
type NullToOBJ<T> = T extends null ? {} : T

export const $unwindDelta = <
  K1 extends s,
  T extends doc,
  K2 extends s,
  U extends doc,
  Null extends null = never,
>(
  k1: AsLiteral<K1>,
  k2: AsLiteral<K2>,
  k: K1 | K2 | false,
  includeNull?: Null,
): RawStages<
  Delta<Rec<K1, T>>,
  Delta<Rec<K1, T> & Rec<K2, Arr<U>>>,
  Delta<Rec<K1, T> & Rec<K2, U | Null> & ID>
> => {
  const outer = includeNull === null

  const newItems = {
    $filter: {
      input: { $ifNull: [`$after.${k2}`, []] },
      as: 'a',
      cond: {
        $not: {
          $in: [
            '$$a._id',
            {
              $map: {
                input: { $ifNull: [`$before.${k2}`, []] },
                as: 'b',
                in: '$$b._id',
              },
            },
          ],
        },
      },
    },
  }

  const oldItems = {
    $filter: {
      input: {
        $map: {
          input: { $ifNull: [`$before.${k2}`, []] },
          as: 'b',
          in: {
            before: '$$b',
            after: {
              $ifNull: [
                {
                  $first: {
                    $filter: {
                      input: `$after.${k2}`,
                      as: 'a',
                      cond: { $eq: ['$$a._id', '$$b._id'] },
                    },
                  },
                },
                null,
              ],
            },
          },
        },
      },
      as: 'a',
      cond: { $ne: ['$$a.before', '$$a.after'] },
    },
  }

  const ifNull = (k: K1 | K2, part: BA, str = `$${[k1, k2].sort()[0]}.${part}._id`) =>
    outer && k == k2 ? { $ifNull: [str, 'null'] } : str
  const interDot = ([a, b]: rawItem[]) => [a, '.', b]

  const partReplace = (part: BA) => ({
    $cond: {
      if: { $or: [{ $eq: [`$${k1}.${part}`, null] }, { $eq: [`$${k2}.${part}`, null] }] },
      then: null,
      else: {
        _id: k
          ? `$${k}.${part}._id`
          : {
              $concat: interDot([k1, k2].sort().map(k => ifNull(k, part))),
            },
        [k1]: `$${k1}.${part}`,
        [k2]: outer
          ? {
              $cond: {
                if: `$${k2}.${part}._id`,
                then: `$${k2}.${part}`,
                else: null,
              },
            }
          : `$${k2}.${part}`,
      },
    },
  })

  const stages = link<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>>()
    .with<unknown, Rec<K1, Delta<T>> & Rec<K2, Arr<Delta<U | NullToOBJ<Null>>>>>(
      asStages([
        {
          $set: {
            [k1]: {
              before: { $ifNull: [`$before.${k1}`, null] },
              after: { $ifNull: [`$after.${k1}`, null] },
            },
            [k2]: {
              $concatArrays: [
                outer
                  ? {
                      $cond: {
                        if: { $eq: [`$before.${k2}`, []] },
                        then: {
                          $cond: {
                            if: { $eq: [`$after.${k2}`, []] },
                            then: [],
                            else: [{ before: {}, after: null }],
                          },
                        },
                        else: oldItems,
                      },
                    }
                  : oldItems,
                {
                  $map: {
                    input: outer
                      ? {
                          $cond: {
                            if: {
                              $and: [{ $ne: [`$before.${k2}`, []] }, { $eq: [`$after.${k2}`, []] }],
                            },
                            then: [{}],
                            else: newItems,
                          },
                        }
                      : newItems,
                    as: 'a',
                    in: { before: null, after: '$$a' },
                  },
                },
              ],
            },
          },
        },
      ]),
    )
    .with<unknown, Rec<K1, Delta<T>> & Rec<K2, Delta<U | NullToOBJ<Null>>>>(
      $unwind_<Rec<K1, Delta<T>>, K2, Delta<U | NullToOBJ<Null>>>(k2),
    )
    .with<unknown, Delta<Rec<K1, T> & Rec<K2, U | Null> & ID>>(
      asStages([
        {
          $replaceWith: {
            _id: '$_id',
            before: partReplace('before'),
            after: partReplace('after'),
          },
        },
      ]),
    ).stages
  return stages as RawStages<
    Delta<Rec<K1, T>>,
    Delta<Rec<K1, T> & Rec<K2, Arr<U>>>,
    Delta<Rec<K1, T> & Rec<K2, U | Null> & ID>
  >
}
