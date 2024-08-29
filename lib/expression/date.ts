import type { Expr } from '../types'

export const datePart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: f => ({ $dateToString: { date: date.raw(f), format: '%Y-%m-%d' } }),
})
export const dayAndMonthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: f => ({ $dateToString: { date: date.raw(f), format: '%m-%d' } }),
})

export const monthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: f => ({ $dateToString: { date: date.raw(f), format: '%Y-%m' } }),
})

export const timePart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: f => ({ $dateToString: { date: date.raw(f), format: '%H-%M' } }),
})

export const startOf = <D, C>(
  startDate: Expr<Date, D, C>,
  freq: Expr<'week' | 'day' | 'month' | 'year', D, C>,
  offset: Expr<number, D, C>,
): Expr<Date, D, C> => ({
  raw: f => ({
    $let: {
      vars: { d: startDate.raw(f), f: freq.raw(f), i: offset.raw(f) },
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
                                    $eq: [{ $floor: { $divide: ['$$i', 100] } }, { $month: '$$d' }],
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

export const toMS = <D, C>(date: Expr<Date, D, C>): Expr<number, D, C> => ({
  raw: f => ({ $toLong: date.raw(f) }),
})

export const dateAdd = <D, C>(
  date: Expr<Date, D, C>,
  amount: Expr<number, D, C>,
  unit: Expr<'year' | 'week' | 'month' | 'day' | 'hour' | 'minute' | 'second', D, C>,
): Expr<Date, D, C> => ({
  raw: f => ({
    $dateAdd: { startDate: date.raw(f), unit: unit.raw(f), amount: amount.raw(f) },
  }),
})

export const maxDate = <D, C>(expr: Expr<Date[], D, C>): Expr<Date, D, C> => ({
  raw: f => ({ $max: expr.raw(f) }),
})

export const minDate = <D, C>(expr: Expr<Date[], D, C>): Expr<Date, D, C> => ({
  raw: f => ({ $min: expr.raw(f) }),
})

export const dateDiff = <D, C>({
  end,
  unit,
  start,
}: {
  start: Expr<Date, D, C>
  end: Expr<Date, D, C>
  unit: Expr<'week' | 'day' | 'month' | 'year', D, C>
}): Expr<number, D, C> => ({
  raw: f => ({
    $let: {
      vars: {
        f: unit.raw(f),
        end: end.raw(f),
        start: start.raw(f),
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
