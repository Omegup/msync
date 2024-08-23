

export const id = <T>(x: T) => x;
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const anoop = async () => {};

// const ze = get<{a:1}[], 'a'>()
export class Field {
  constructor(readonly field: string) {}
  add = (k: keyof never) =>
    new Field(this.field ? `${this.field}.${k.toString()}` : k.toString());
}
