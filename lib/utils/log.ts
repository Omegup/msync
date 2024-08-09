const T = (s: string) =>
  `Timestamp(${parseInt(`${BigInt(s) / 2n ** 32n}`)}, ${parseInt(`${BigInt(s) % 2n ** 32n}`)})`

const replace = (s: string)=>s.replace(/\{"\$timestamp":"(\d+)"\}/g, (_, d) => T(d))
const json = (a: object) => replace(JSON.stringify(a))

export const log = (...args: unknown[]) =>
  console.log(
    new Date(),
    ...args.map(a => (typeof a === 'function' ? a(replace) : a && typeof a === 'object' ? json(a) : a)),
  )
