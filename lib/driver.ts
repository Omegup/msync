import type { Driver } from '../types'
export type { Driver } from '../types'

let current: Driver | undefined

export const useDriver = (driver: Driver) => {
  current = driver
}

export const driver = (): Driver => {
  if (!current) throw new Error('msync: call useDriver({ Timestamp, UUID }) before running')
  return current
}

export const uuid = () => new (driver().UUID)().toString('base64')
