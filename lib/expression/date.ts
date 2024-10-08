import type { Expr } from '../types'
import { asExpr, asExprRaw } from './expr-base'

export const dayAndMonthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $dateToString: { date: date.raw(f).get(), format: '%m-%d' } }),
  })
export const now = <D, C>(): Expr<Date, D, C> =>
  asExpr<Date, D, C>({
    raw: f => asExprRaw('$$NOW'),
  })
export const monthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> =>
  asExpr<string, D, C>({
    raw: f => asExprRaw({ $dateToString: { date: date.raw(f).get(), format: '%Y-%m' } }),
  })

export const dateAdd = <D, C>(
  date: Expr<Date, D, C>,
  amount: Expr<number, D, C>,
  unit: Expr<'year' | 'week' | 'month' | 'day' | 'hour' | 'minute' | 'second', D, C>,
): Expr<Date, D, C> =>
  asExpr<Date, D, C>({
    raw: f =>
      asExprRaw({
        $dateAdd: {
          startDate: date.raw(f).get(),
          unit: unit.raw(f).get(),
          amount: amount.raw(f).get(),
        },
      }),
  })

export const startOf = <D, C>(
  startDate: Expr<Date, D, C>,
  freq: Expr<'week' | 'day' | 'month' | 'year', D, C>,
  offset: Expr<number, D, C>,
): Expr<Date, D, C> =>
  asExpr<Date, D, C>({
    raw: f =>
      asExprRaw({
        $let: {
          vars: { d: startDate.raw(f).get(), f: freq.raw(f).get(), i: offset.raw(f).get() },
          in: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$$f', 'week'] },
                  then: {
                    $dateFromParts: {
                      isoWeekYear: { $isoWeekYear: '$$d' },
                      isoWeek: {
                        $add: [
                          { $isoWeek: '$$d' },
                          {
                            $cond: {
                              if: {
                                $lt: ['$$i', { $isoDayOfWeek: '$$d' }],
                              },
                              then: 1,
                              else: 0,
                            },
                          },
                        ],
                      },
                      isoDayOfWeek: '$$i', // 1 is default = monday
                    },
                  },
                },
                {
                  case: { $eq: ['$$f', 'month'] },
                  then: {
                    $dateFromParts: {
                      year: { $year: '$$d' },
                      month: {
                        $add: [
                          { $month: '$$d' },
                          {
                            $cond: {
                              if: {
                                $lt: ['$$i', { $dayOfMonth: '$$d' }],
                              },
                              then: 1,
                              else: 0,
                            },
                          },
                        ],
                      },
                      day: '$$i', // 1 is default = 1
                    },
                  },
                },
                {
                  case: { $eq: ['$$f', 'year'] },
                  then: {
                    $dateFromParts: {
                      year: {
                        $add: [
                          { $year: '$$d' },
                          {
                            $cond: {
                              if: {
                                $or: [
                                  {
                                    $lt: [{ $floor: { $divide: ['$$i', 100] } }, { $month: '$$d' }],
                                  },
                                  {
                                    $and: [
                                      {
                                        $eq: [
                                          { $floor: { $divide: ['$$i', 100] } },
                                          { $month: '$$d' },
                                        ],
                                      },
                                      {
                                        $lt: [{ $mod: ['$$i', 100] }, { $dayOfMonth: '$$d' }],
                                      },
                                    ],
                                  },
                                ],
                              },
                              then: 1,
                              else: 0,
                            },
                          },
                        ],
                      },
                      month: { $floor: { $divide: ['$$i', 100] } }, // 101 is default = 1
                      day: { $mod: ['$$i', 100] }, // 101 is default = 1
                    },
                  },
                },
              ],
              default: {
                $dateFromParts: {
                  year: { $year: '$$d' },
                  month: { $month: '$$d' },
                  day: { $add: [{ $dayOfMonth: '$$d' }, '$$i'] }, // 0 default = 0
                },
              },
            },
          },
        },
      }),
  })

export const dateDiff = <D, C>({
  end,
  unit,
  start,
}: {
  start: Expr<Date, D, C>
  end: Expr<Date, D, C>
  unit: Expr<'week' | 'day' | 'month' | 'year', D, C>
}): Expr<number, D, C> =>
  asExpr<number, D, C>({
    raw: f =>
      asExprRaw({
        $let: {
          vars: {
            f: unit.raw(f).get(),
            end: end.raw(f).get(),
            start: start.raw(f).get(),
          },
          in: {
            $let: {
              vars: {
                diff: {
                  $dateDiff: {
                    startDate: '$$start',
                    endDate: '$$end',
                    unit: '$$f',
                  },
                },
              },
              in: {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ['$$f', 'month'] },
                      then: {
                        $cond: {
                          if: {
                            $lte: [{ $dayOfMonth: '$$start' }, { $dayOfMonth: '$$end' }],
                          },
                          then: '$$diff',
                          else: { $subtract: ['$$diff', 1] },
                        },
                      },
                    },
                    {
                      case: { $eq: ['$$f', 'week'] },
                      then: {
                        $cond: {
                          if: {
                            $lte: [{ $isoDayOfWeek: '$$start' }, { $isoDayOfWeek: '$$end' }],
                          },
                          then: '$$diff',
                          else: { $subtract: ['$$diff', 1] },
                        },
                      },
                    },
                    {
                      case: { $eq: ['$$f', 'year'] },
                      then: {
                        $cond: {
                          if: {
                            $or: [
                              {
                                $lt: [{ $month: '$$start' }, { $month: '$$end' }],
                              },
                              {
                                $and: [
                                  {
                                    $eq: [{ $month: '$$start' }, { $month: '$$end' }],
                                  },
                                  {
                                    $lte: [{ $dayOfMonth: '$$start' }, { $dayOfMonth: '$$end' }],
                                  },
                                ],
                              },
                            ],
                          },
                          then: '$$diff',
                          else: { $subtract: ['$$diff', 1] },
                        },
                      },
                    },
                  ],
                  default: '$$diff',
                },
              },
            },
          },
        },
      }),
  })
