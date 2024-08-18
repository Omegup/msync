export async function* merge<T>(asyncIterators: readonly AsyncIterator<T, unknown, never>[]): AsyncIterator<T, void, never> {
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

