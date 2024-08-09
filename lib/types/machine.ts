// first emission means every descendent is done first aggregation
// type Iter = AsyncIterator<void, never, never>
export type Machine<T> = (restart: AsyncIterator<void, never, void>) => AsyncIterator<T, never, void>
export type Runner<T> = AsyncIterator<[data: T, nextReady: { then: (handler: () => void) => void }], never, void>


