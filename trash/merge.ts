async function* merge<T, R, N>(asyncIterators: readonly AsyncIterator<T, R, N>[]): AsyncIterator<T, readonly R[], N> {
  const promises = asyncIterators.map(iterator => iterator.next());
  const returnValues: R[] = Array(asyncIterators.length)

  while (promises.length > 0) {
    const res = await Promise.race(promises.map((p, index) => p.then(res => ({ ...res, index }))));
    if (res.done) {
      const { value, index } = res
      promises.splice(index, 1);
      returnValues[index] = value
    } else {
      const { value, index } = res
      promises[index] = asyncIterators[index].next(yield value);
    }
  }
  return returnValues
}




