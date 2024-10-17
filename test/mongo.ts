import { writeFile } from 'fs/promises'
import { Collection, MongoClient } from 'mongodb'
import type { AsynIter, Iterator, IteratorResult } from '../lib/types'
import type { doc } from '../types'
import { uri } from './uri'
import type { CommandStartedEvent, Db, OptionalUnlessRequiredId } from 'mongodb'

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
const clears: (() => Promise<void>)[] = []
export const makeCol = async <T extends doc>(
  docs: readonly OptionalUnlessRequiredId<T>[],
  database: Db,
  name?: string,
) => {
  if (!name) {
    const n = (name = crypto.randomUUID())
    clears.push(async () => {
      await database.collection(n).drop({ ignoreUndefined: true })
    })
  }
  // Enable history at collection level
  try {
    const col = await database.createCollection<T>(name, {
      changeStreamPreAndPostImages: { enabled: true },
    })
    if (docs.length) await col.insertMany([...docs])
    return col
  } catch {
    return database.collection<T>(name)
  }
}
