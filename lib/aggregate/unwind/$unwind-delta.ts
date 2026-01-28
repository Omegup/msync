import type { Arr, AsLiteral, ID, Rec, doc, rawItem } from '../../../types'
import { ne, type NullToOBJ } from '../../expression'
import { root } from '../../field'
import { $expr } from '../../predicate'
import type { BA, Delta, RawStages } from '../../types'
import { $match_, $unwind_ } from '../mongo-stages'
import { asStages, link } from '../prefix'

type s = string

export const $unwindDelta = <
  K1 extends s,
  T extends doc,
  K2 extends s,
  U extends doc,
  N1 extends null = never,
  N2 extends null = never,
>(
  k1: AsLiteral<K1>,
  k2: AsLiteral<K2>,
  k: K1 | K2 | false,
  middle?: string,
  includeNull1?: N1,
  includeNull2?: N2,
): RawStages<
  Delta<Rec<K1, T | N1>>,
  Delta<Rec<K1, T | N1> & Rec<K2, Arr<U>>>,
  Delta<Rec<K1, T | N1> & Rec<K2, U | N2> & ID>
> => {
  const outer1 = includeNull1 === null
  const outer2 = includeNull2 === null

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
  }

  const ifNull = (k: K1 | K2, part: BA, str = `$${k}.${part}._id`) =>
    outer2 && k == k2 ? { $ifNull: [str, 'null'] } : str
  const interDot = ([a, b]: rawItem[]) => [a, middle ?? '.', b]

  const partReplace = (part: BA) => {
    const def = {
      _id: k
        ? ifNull(k, part)
        : {
            $concat: interDot([k1, k2].sort().map(k => ifNull(k, part))),
          },
      [k1]: `$${k1}.${part}`,
      [k2]: outer2
        ? {
            $cond: {
              if: `$${k2}.${part}._id`,
              then: `$${k2}.${part}`,
              else: null,
            },
          }
        : `$${k2}.${part}`,
    }
    const skipNulls = [{ $eq: [`$${k1}.${part}`, null] }, { $eq: [`$${k2}.${part}`, null] }].filter(
      (_, i) => ![outer1, outer2][i],
    )
    if (skipNulls.length === 0) return def
    return {
      $cond: {
        if: skipNulls.length === 1 ? skipNulls[0] : { $or: skipNulls },
        then: null,
        else: def,
      },
    }
  }

  const part = (k: BA) => root<Delta<Rec<K1, T | N1> & Rec<K2, U | N2> & ID>>().of(k).expr()

  const stages = link<Delta<Rec<K1, T | N1> & Rec<K2, Arr<U>>>>()
    .with<unknown, Rec<K1, Delta<T>> & Rec<K2, Arr<Delta<U | NullToOBJ<N2>>>>>(
      asStages([
        {
          $set: {
            [k1]: {
              before: { $ifNull: [`$before.${k1}`, null] },
              after: { $ifNull: [`$after.${k1}`, null] },
            },
            [k2]: {
              $concatArrays: [
                outer2
                  ? {
                      $cond: {
                        if: { $eq: [`$before.${k2}`, []] },
                        then: {
                          $cond: {
                            if: { $eq: [`$after.${k2}`, []] },
                            then: [{ before: {}, after: {} }],
                            else: [{ before: {}, after: null }],
                          },
                        },
                        else: oldItems,
                      },
                    }
                  : oldItems,
                {
                  $map: {
                    input: outer2
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
    .with<unknown, Rec<K1, Delta<T>> & Rec<K2, Delta<U | NullToOBJ<N2>>>>(
      $unwind_<Rec<K1, Delta<T>>, K2, Delta<U | NullToOBJ<N2>>>(k2),
    )
    .with<unknown, Delta<Rec<K1, T | N1> & Rec<K2, U | N2> & ID>>(
      asStages([
        {
          $replaceWith: {
            _id: '$_id',
            before: partReplace('before'),
            after: partReplace('after'),
          },
        },
        ...(!k && middle ? [{ $set: { _id: { $ifNull: ['$before._id', '$after._id'] } } }] : []),
      ]),
    )
    .with<unknown, Delta<Rec<K1, T | N1> & Rec<K2, U | N2> & ID>>(
      $match_($expr(ne(part('before'))(part('after')))),
    ).stages
  return stages as RawStages<
    Delta<Rec<K1, T | N1>>,
    Delta<Rec<K1, T | N1> & Rec<K2, Arr<U>>>,
    Delta<Rec<K1, T | N1> & Rec<K2, U | N2> & ID>
  >
}
