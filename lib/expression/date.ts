import type { Expr } from '../types'

export const datePart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%Y-%m-%d' } }),
})
export const dayAndMonthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%m-%d' } }),
})

export const monthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%Y-%m' } }),
})

export const timePart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%H-%M' } }),
})

export const startOf = <D, C>(
  startDate: Expr<Date, D, C>,
  freq: Expr<'week' | 'day' | 'month' | 'year', D, C>,
  offset: Expr<number, D, C>,
): Expr<Date, D, C> => ({
  raw: () => ({
    $let: {
      vars: { d: startDate.raw(), f: freq.raw(), i: offset.raw() },
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
  raw: () => ({ $toLong: date.raw() }),
})

export const dateAdd = <D, C>(
  date: Expr<Date, D, C>,
  amount: Expr<number, D, C>,
  unit: Expr<'year' | 'week' | 'month' | 'day' | 'hour' | 'minute' | 'second', D, C>,
): Expr<Date, D, C> => ({
  raw: () => ({
    $dateAdd: { startDate: date.raw(), unit: unit.raw(), amount: amount.raw() },
  }),
})

export const maxDate = <D, C>(expr: Expr<Date[], D, C>): Expr<Date, D, C> => ({
  raw: () => ({ $max: expr.raw() }),
})

export const minDate = <D, C>(expr: Expr<Date[], D, C>): Expr<Date, D, C> => ({
  raw: () => ({ $min: expr.raw() }),
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
  raw: () => ({
    $let: {
      vars: {
        f: unit.raw(),
        end: end.raw(),
        start: start.raw(),
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
