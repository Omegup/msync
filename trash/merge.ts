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




async function* mergeSimple<T>(asyncIterators: readonly AsyncIterator<T, unknown, never>[]): AsyncIterator<T, void, never> {
  const promises = asyncIterators.map(iterator => iterator.next());

  while (promises.length > 0) {
    const { value, index, done } = await Promise.race(promises.map((p, index) => p.then(res => ({ ...res, index }))));
    if (done) {
      promises.splice(index, 1);
    } else {
      yield value
      promises[index] = asyncIterators[index].next();
    }
  }
}

