import type { JsonObj, View } from '../types'
import { aggregate } from './stream/aggregate'
import type { Pipeline, Runner, Stream } from './types'

async function* executes<T extends JsonObj, Result extends JsonObj>(
  view: View<T>,
  input: Pipeline<T, Result>,
): Runner<readonly T[]> {
  while (true) {
    const {collection: coll, projection, match} = view
    aggregate({db: coll.s.db, comment: })
  }
}

export const from = <T extends JsonObj>(view: View<T>): Stream<T> => ({
  execute: executionParam => executes(view, executionParam),
})


// STRING MANIPULATION TOOLS
type First<T extends string> = T extends `${infer U}${string}` ? U : ''
type RemoveFirst<T extends string> = T extends `${string}${infer U}` ? U : ''

type Reverse<U extends string> = U extends ''
  ? ''
  : U extends '1' | '0'
  ? U
  : `${Reverse<RemoveFirst<U>>}${First<U>}`


// TAPE DATA STRUCTURE
type Tape = {left: string; current: string; right: string}

// TRANSITIONS
type MoveRight<T extends Tape> = {
  left: `${T['left']}${T['current']}`
  current: First<T['right']>
  right: RemoveFirst<T['right']>
}

type MoveLeft<T extends Tape> = {
  left: RemoveFirst<T['left']>
  current: First<T['left']>
  right: `${T['right']}${T['current']}`
}

type Write<T extends Tape, Value extends '0' | '1'> = {
  left: T['left']
  current: Value
  right: T['right']
}

// STATES
// program is 3 state busy beaver
type StateA<T extends Tape> = T['current'] extends '1'
  ? StateC<MoveLeft<T>>
  : StateB<MoveRight<Write<T, '1'>>>

type StateB<T extends Tape> = T['current'] extends '1'
  ? StateB<MoveRight<T>>
  : StateA<MoveLeft<Write<T, '1'>>>

type StateC<T extends Tape> = T['current'] extends '1'
  ? Halt<MoveRight<T>>
  : StateB<MoveLeft<Write<T, '1'>>>

type Halt<T extends Tape> = T
type ToString<T extends Tape> = `${Reverse<T['left']>}${T['current']}${T['right']}`
type Start = {left: ''; current: ''; right: ''}

// RESULTS
type Result = ToString<StateA<Start>>
// type Result = "111111"
