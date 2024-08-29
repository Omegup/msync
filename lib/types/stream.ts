import type { App, HKT, ID, JsonObj, RawObj, ReadonlyCollection, Type } from '../../types'
import type { Runner, Working } from './machine'

declare const RawStage: unique symbol

export type RawStagesPart<S, R> = readonly RawObj[] & {
  [Type]?(_: typeof RawStage, source: S): readonly [typeof RawStage, R]
}
export type RawStagesSource<in out S, out R> = {
  stages: RawStagesPart<S, R>
  coll: ReadonlyCollection<S>
}
export type RawStages<out R> = <E>(consume: <S>(value: RawStagesSource<S, R>) => E) => E

export type SnapshotStreamExecutionResult<V> = {
  readonly run: <Result extends JsonObj>(
    // this is the final input that should end with a merge stage
    input: RawStagesPart<Delta<V>, Result>,
  ) => Runner<readonly Result[], Working>
  readonly stages: RawStages<Delta<V>>
}

export type Stream<T extends JsonObj, F extends HKT<JsonObj>> = <Result extends JsonObj>(
  input: RawStagesPart<T, Result>,
) => App<F, Result>

export type PreDelta<T, E> = { readonly [_ in 'before' | 'after']: T } & E
export type Delta<T, E = ID> = PreDelta<T | null, E>
export type UDelta<T> = Delta<T | null, ID & { readonly updated: boolean }>

// this type of streams is based on the separation between
// • last snapshot which is the last data successfully synced
// • and the new incoming data to be synced
export type SnapshotStream<T extends JsonObj> = <Result extends JsonObj>(
  // this input doesn't end necessarily with merge stage, cuz it can be used for another lookup
  // so input can be used to construct the stages of the left/rigth join of another lookup
  input: RawStagesPart<Delta<T>, Delta<Result>>,
) => SnapshotStreamExecutionResult<Result>
