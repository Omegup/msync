import { writeFile } from 'fs/promises'
import { Collection, MongoClient } from 'mongodb'
import type { AsynIter, Iterator, IteratorResult } from '../lib/types'
import type { doc } from '../types'
import { uri } from './uri'
import type { CommandStartedEvent } from 'mongodb'

export const run = <T, Info>(cont: Iterator<T, Info>) => runCont(cont())
const runCont = async <T, Info>({ next }: IteratorResult<T, Info>): Promise<never> => {
  const { cont, info } = await next
  console.log(info)
  return runCont(cont())
}
export const iterate = <T>([, next]: AsynIter<T>): PromiseLike<never> => next().then(iterate)

export const enablePreAndPostImages = <T extends doc>(coll: Collection<T>) =>
  coll.s.db.command({
    collMod: coll.collectionName,
    changeStreamPreAndPostImages: { enabled: true },
  })

export const prepare = async (testName?: string) => {
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
