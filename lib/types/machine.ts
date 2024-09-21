// first emission means every descendent is done first aggregation

export type HasJob = { job: object | undefined }
export type Runner<T, Dom extends HasJob> = Iterator<T, Dom>

export type NextFrame<T, Dom> = PromiseLike<Frame<T, Dom>>

export type Frame<T, Dom> = {
  data: T
  info: Dom
  cont: Iterator<T, Dom>
}


export type IteratorResult<out T, out Dom> = {
  next: NextFrame<T, Dom>
  stop: Iterator<T, Dom>
}

export type Iterator<out T, out Dom> = () => IteratorResult<T, Dom>

export type AsynIter<T> = readonly [T, () => PromiseLike<AsynIter<T>>]
