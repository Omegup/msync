export function splitAsyncIterator<T>(): [AsyncIterator<T, never, void>, push: (value: T) => void] {
  const queue: T[] = [];
  let nextPromise: ((result: IteratorResult<T, never>) => void) | null = null;

  async function next(): Promise<IteratorResult<T, never>> {
    if (queue.length > 0) {
      return { value: queue.shift()!, done: false };
    }
    return new Promise(resolve => nextPromise = resolve);
  }

  function push(value: T): void {
    if (nextPromise) {
      nextPromise({ value, done: false });
      nextPromise = null;
    } else {
      queue.push(value);
    }
  }

  return [{ next }, push];
}
