// first emission means every descendent is done first aggregation

export type HasJob = { job: object | undefined }
export type Runner<T, Info extends HasJob> = Iterator<T, Info>

export type NextFrame<T, Info> = PromiseLike<Frame<T, Info>>

export type Frame<T, Info> = {
  data: T
  info: Info
  cont: Iterator<T, Info>
}


export type IteratorResult<out T, out Info> = {
  next: NextFrame<T, Info>
  stop: Iterator<T, Info>
}

export type Iterator<out T, out Info> = () => IteratorResult<T, Info>

export type AsynIter<T> = readonly [T, () => PromiseLike<AsynIter<T>>]
