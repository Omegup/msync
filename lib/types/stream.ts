import type { App, HKT, JsonObj, ReadonlyCollection, Type } from '../../types'
import type { Runner } from './machine'

declare const RawStage: unique symbol
declare const Pipeline: unique symbol

export type RawStagesPart<S, R> = readonly JsonObj[] & {
  [Type]?(_: typeof RawStage, source: S): readonly [typeof RawStage, R]
}
export type RawStagesSource<in out S, out R> = { stages: RawStagesPart<S, R>; coll: ReadonlyCollection<S> }
export type RawStages<out R> = <E>(
  consume: <S>(value: RawStagesSource<S, R>) => E,
) => E


export type SnapshotStreamExecutionResult<V> = {
  readonly run: <Result extends JsonObj>(
    // this is the final input that should end with a merge stage
    input: RawStagesPart<V, Result>,
  ) => Runner<readonly Result[], unknown>
  readonly stages: RawStages<V>
}

export type Stream<T extends JsonObj, F extends HKT<JsonObj>> = <Result extends JsonObj>(
  input: RawStagesPart<T, Result>,
) => App<F, Result>


// this type of streams is based on the separation between 
// • last snapshot which is the last data successfully synced 
// • and the new incoming data to be synced
export type StreamSnapshot<T extends JsonObj> = <Result extends JsonObj>(
  // this input doesn't end necessarily with merge stage, cuz it can be used for another lookup
  // so input can be used to construct the stages of the left/rigth join of another lookup 
  input: RawStagesPart<T, Result>,
) => SnapshotStreamExecutionResult<Result>

export interface StreamHKT extends HKT<JsonObj> {}
