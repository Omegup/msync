import { ArrHKT } from '../types/hkt';
import { jsonItem } from '../types/json';
import {
  equal,
  makeDualOperandPredicate,
  negative,
  positive,
} from './utils';

const dualIn = makeDualOperandPredicate<'$in' | '$nin', ArrHKT<jsonItem>>(
  (a) => (x) => a.some((a) => equal(a, x))
);

export const $in = dualIn('$in', positive);
export const $nin = dualIn('$nin', negative);
