import type { Arr, AsLiteral, ID, Rec, doc } from '../../../types'
import type { Delta, RawStages } from '../../types'
import { $unwind_ } from '../mongo-stages'
import { asStages, link } from '../prefix'

type s = string

export const $unwindDelta = <K1 extends s, T extends doc, K2 extends s, U extends doc>(
  k1: AsLiteral<K1>,
  k2: AsLiteral<K2>,
  k: K1 | K2 | false,
) => {
  const stages = link<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>>()
    .with<unknown, Rec<K1, Delta<T>> & Rec<K2, Arr<Delta<U>>>>(
      asStages([
        {
          $set: {
            [k1]: {
              before: { $ifNull: [`$before.${k1}`, null] },
              after: { $ifNull: [`$after.${k1}`, null] },
            },
            [k2]: {
              $concatArrays: [
                {
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
                {
                  $map: {
                    input: {
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
                    },
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
    .with<unknown, Rec<K1, Delta<T>> & Rec<K2, Delta<U>>>(
      $unwind_<Rec<K1, Delta<T>>, K2, Delta<U>>(k2),
    )
    .with<unknown, Delta<Rec<K1, T> & Rec<K2, U> & ID>>(
      asStages([
        {
          $replaceWith: {
            _id: "$_id",
            before: {
              $cond: {
                if: { $or: [{ $eq: [`$${k1}.before`, null] }, { $eq: [`$${k2}.before`, null] }] },
                then: null,
                else: {
                  _id: {
                    $concat: k
                      ? `$${k}.before._id`
                      : [
                          `$${[k1, k2].sort()[0]}.before._id`,
                          '.',
                          `$${[k1, k2].sort()[1]}.before._id`,
                        ],
                  },
                  [k1]: `$${k1}.before`,
                  [k2]: `$${k2}.before`,
                },
              },
            },
            after: {
              $cond: {
                if: { $or: [{ $eq: [`$${k1}.after`, null] }, { $eq: [`$${k2}.after`, null] }] },
                then: null,
                else: {
                  _id: {
                    $concat: k
                      ? `$${k}.after._id`
                      : [
                          `$${[k1, k2].sort()[0]}.after._id`,
                          '.',
                          `$${[k1, k2].sort()[1]}.after._id`,
                        ],
                  },
                  [k1]: `$${k1}.after`,
                  [k2]: `$${k2}.after`,
                },
              },
            },
          },
        },
      ]),
    ).stages
  return stages as RawStages<
    Delta<Rec<K1, T>>,
    Delta<Rec<K1, T> & Rec<K2, Arr<U>>>,
    Delta<Rec<K1, T> & Rec<K2, U> & ID>
  >
}
