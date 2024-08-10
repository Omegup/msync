import dayjs from 'dayjs';

import { Predicate } from '../types/predicate';

export const dateLt = (value: Date): Predicate<Date> => ({
  raw: { $lt: value },
  deepTest: (accessor) => accessor((x) => dayjs(x).diff(value) < 0, true),
});
