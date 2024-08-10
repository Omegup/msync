import { Expr, jsonItem } from '../types'
import dayjs from 'dayjs'

export const datePart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%Y-%m-%d' } }),
  eval: (d, c) => {
    return date.eval(d, c).toISOString().slice(0, 10) ?? ''
  },
})
export const dayAndMonthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%m-%d' } }),
  eval: (d, c) => dayjs(date.eval(d, c)).format('DD-MM'),
})

export const monthPart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%Y-%m' } }),
  eval: (d, c) => {
    return date.eval(d, c).toISOString().slice(0, 7) ?? ''
  },
})

export const timePart = <D, C>(date: Expr<Date, D, C>): Expr<string, D, C> => ({
  raw: () => ({ $dateToString: { date: date.raw(), format: '%H-%M' } }),
  eval: (d, c) => {
    return date.eval(d, c).toISOString().slice(11, 16) ?? ''
  },
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
  eval: (d, c) => {
    const f = freq.eval(d, c),
      i = offset.eval(d, c)
    const start = new Date(startDate.eval(d, c).toISOString().slice(0, 10) + 'Z')
    const output = new Date(start)
    if (f === 'day' || f === 'week') {
      const day = f === 'week' ? output.getUTCDay() || 7 : 0
      output.setUTCDate(output.getUTCDate() - day + i)
      if (f === 'week' && output < start) {
        output.setUTCDate(output.getUTCDate() + 7)
      }
    } else if (f === 'year') {
      output.setUTCMonth(Math.floor(i / 100) - 1)
      output.setUTCDate(i % 100)
      if (output < start) {
        output.setUTCFullYear(output.getUTCFullYear() + 1)
      }
    } else {
      output.setUTCDate(i)
      if (output < start) {
        output.setUTCMonth(output.getUTCMonth() + 1)
      }
    }
    return output
  },
})

export const toMS = <D, C>(date: Expr<Date, D, C>): Expr<number, D, C> => ({
  raw: () => ({ $toLong: date.raw() }),
  eval: (d, c) => date.eval(d, c).getTime(),
})

export const dateAdd = <D, C>(
  date: Expr<Date, D, C>,
  amount: Expr<number, D, C>,
  unit: Expr<'year' | 'week' | 'month' | 'day' | 'hour' | 'minute' | 'second', D, C>,
): Expr<Date, D, C> => ({
  raw: () => ({
    $dateAdd: { startDate: date.raw(), unit: unit.raw(), amount: amount.raw() },
  }),
  eval: (d, c) => dayjs(date.eval(d, c)).add(amount.eval(d, c), unit.eval(d, c)).toDate(),
})

export const maxDate = <D, C>(expr: Expr<Date[], D, C>): Expr<Date, D, C> => ({
  raw: () => ({ $max: expr.raw() }),
  eval: (d, c) =>
    expr
      .eval(d, c)
      .map(x => dayjs(x))
      .reduce((a, b) => (a.diff(b) < 0 ? b : a))
      .toDate(),
})

export const minDate = <D, C>(expr: Expr<Date[], D, C>): Expr<Date, D, C> => ({
  raw: () => ({ $min: expr.raw() }),
  eval: (d, c) =>
    expr
      .eval(d, c)
      .map(x => dayjs(x))
      .reduce((a, b) => (a.diff(b) < 0 ? a : b))
      .toDate(),
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
  eval: (d, c) => {
    const e = dayjs(end.eval(d, c))
    const s = dayjs(start.eval(d, c)).startOf('day')
    const diff = e.diff(s, unit.eval(d, c))
    return diff
  },
})
