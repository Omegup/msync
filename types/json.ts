import { Timestamp } from "mongodb";

export type jsonItem = number | null | string | boolean | json | Timestamp | Date;
export interface JsonObj {
  readonly [_: string]: jsonItem | undefined;
}
export type json = readonly jsonItem[] | JsonObj;
