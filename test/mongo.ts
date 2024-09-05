import { writeFile } from 'fs/promises'
import { Collection, MongoClient } from 'mongodb'
import type { AsynIter, Iterator, IteratorResult } from '../lib/types'
import type { doc } from '../types'
import { uri } from './uri'
import type { CommandStartedEvent } from 'mongodb'

export const run = <T, Dom>(cont: Iterator<T, Dom>) => cont(next => runCont(next))
const runCont = async <T, S extends Dom, Dom>({
  next,
  cont,
}: IteratorResult<T, S, Dom>): Promise<never> => {
  const v: S = await next
  return cont(v)(runCont)
}
export const linker = <T, S extends Dom, Dom>({
  data,
  next,
  cont,
}: IteratorResult<T, S, Dom>): AsynIter<T> => {
  return [data, () => next.then(v => cont(v)(next => linker(next)))]
}
export const iterate = <T>([, next]: AsynIter<T>): PromiseLike<never> => next().then(iterate)

export const enablePreAndPostImages = <T extends doc>(coll: Collection<T>) =>
  coll.s.db.command({
    collMod: coll.collectionName,
    changeStreamPreAndPostImages: { enabled: true },
  })

export const prepare = async (testName: string) => {
  const client = new MongoClient(uri, testName ? { monitorCommands: true } : {})

  if (testName) {
    const handler = (c: CommandStartedEvent) => {
      writeFile(`./out/${testName}.log`, JSON.stringify(c.command) + ',\n', { flag: 'w' })
    }
    client.on('commandStarted', handler)
    client.on('commandSucceeded', handler)
  }
  await client.connect()
  await client.db('admin').command({
    setClusterParameter: {
      changeStreamOptions: {
        preAndPostImages: { expireAfterSeconds: 60 },
      },
    },
  })
  return client
}
