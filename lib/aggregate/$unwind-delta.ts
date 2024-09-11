import type { Arr, ID, Rec, doc } from '../../types'
import type { Delta, RawStages } from '../types'
import { $unwind_ } from './mongo-stages'
import { asStages, link } from './prefix'

type s = string

export const $unwindDelta = <K1 extends s, T extends doc, K2 extends s, U extends doc>(
  k1: K1,
  k2: K2,
): RawStages<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>, Delta<Rec<K1, T> & Rec<K2, U> & ID>> =>
  link<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>>()
    .with<Rec<K1, Delta<T>> & Rec<K2, Arr<Delta<U>>>>(
      asStages([
        {
          $replaceWith: {
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
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: `$after.${k2}`,
                                  as: 'a',
                                  cond: { $eq: ['$$a._id', '$$b._id'] },
                                },
                              },
                              0,
                            ],
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
    .with<Rec<K1, Delta<T>> & Rec<K2, Delta<U>>>($unwind_(k2))
    .with<Delta<Rec<K1, T> & Rec<K2, U> & ID>>(
      asStages([
        {
          $replaceWith: {
            before: {
              $cond: {
                if: { $or: [{ $eq: [`$${k1}.before`, null] }, { $eq: [`$${k2}.before`, null] }] },
                then: null,
                else: {
                  _id: { $concat: [`$${[k1, k2].sort()[0]}.before._id`, '.', `$${[k1, k2].sort()[1]}.before._id`] },
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
                  _id: { $concat: [`$${[k1, k2].sort()[0]}.after._id`, '.', `$${[k1, k2].sort()[1]}.after._id`] },
                  [k1]: `$${k1}.after`,
                  [k2]: `$${k2}.after`,
                },
              },
            },
          },
        },
      ]),
    ).stages
