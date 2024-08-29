export const id = <T>(x: T) => x
export const defined = <T>(x: T | undefined | null): x is T => x != null
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {}
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const anoop = async () => {}
