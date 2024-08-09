import type { Timestamp } from "mongodb";
import type { JsonObj, Type } from "../../types";
import type { Query } from "./query";
import type { Runner } from "./machine";

declare const Pipeline: unique symbol;

export type RawStages = { stages: JsonObj[], coll: string }
export type PipelineParam = { matchTs: boolean; }
export type Stages = (param: PipelineParam) => RawStages
export type Pipeline<in S, out T> = {
  [Type]?(_: typeof Pipeline, s: S): readonly [typeof Pipeline, T];
  stages: (time: Timestamp | null, addTs: (param: PipelineParam, match?: Query<never>) => JsonObj[]) =>
    (previousStages: Stages) => Stages;
}


export type Stream<
  out T extends JsonObj,
> = {
  execute: <Result extends JsonObj>(
    input: Pipeline<T, Result>
  ) => Runner<readonly T[]>;
};

