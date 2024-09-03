import type { Arr, ID, Rec, doc } from '../../types'
import type { Delta, RawStages } from '../types'
import { $unwind_ } from './mongo-stages'
import { asStages, link } from './prefix'

type s = string

export const $unwindDelta = <K1 extends s, T, K2 extends s, U extends doc>(
  k1: K1,
  k2: K2,
): RawStages<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>, Delta<Rec<K1, T> & Rec<K2, U> & ID>> =>
  link<Delta<Rec<K1, T> & Rec<K2, Arr<U>>>>()
    .with<Rec<K1, Delta<T>> & Rec<K2, Arr<Delta<U>>>>(
      asStages([
        {
          $replaceWith: {
            [k1]: {
              before: `$before.${k1}`,
              after: `$after.${k1}`,
            },
            [k2]: {
              $concatArrays: [
                {
                  $map: {
                    input: `$before.${k2}`,
                    as: 'b',
                    in: {
                      before: '$$b',
                      after: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: `$after.${k2}`,
                              as: 'a',
                              cond: { $eq: ['$$a.id', '$$b.id'] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                  },
                },
                {
                  $map: {
                    input: {
                      $filter: {
                        input: `$after.${k2}`,
                        as: 'a',
                        cond: {
                          $not: {
                            $in: [
                              '$$a.id',
                              { $map: { input: `$before.${k2}`, as: 'b', in: '$$b.id' } },
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
                if: { $or: [{ $eq: [`$k1.before`, null] }, { $eq: [`$k2.before`, null] }] },
                then: null,
                else: {
                  _id: { $concat: ['$k1.before._id', '.', '$k2.before._id'] },
                  k1: '$k1.before',
                  k2: '$k2.before',
                },
              },
            },
            after: {
              $cond: {
                if: { $or: [{ $eq: [`$k1.after`, null] }, { $eq: [`$k2.after`, null] }] },
                then: null,
                else: {
                  _id: { $concat: ['$k1.after._id', '.', '$k2.after._id'] },
                  k1: '$k1.after',
                  k2: '$k2.after',
                },
              },
            },
          },
        },
      ]),
    ).stages
