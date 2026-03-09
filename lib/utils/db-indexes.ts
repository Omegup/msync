import type { Collection, CreateIndexesOptions, IndexSpecification } from 'mongodb'
import { type log as log1 } from './log';


export const indexMap = new Map<string, Map<string, Promise<void>>>()

export const createIndex = async (
  collection: { readonly createIndex: Collection['createIndex']; collectionName: string },
  indexSpec: IndexSpecification,
  op?: CreateIndexesOptions,
) => {
  const { name, ...options } = op ?? {}
  const map = indexMap.get(collection.collectionName) ?? new Map<string, Promise<void>>()
  indexMap.set(collection.collectionName, map)
  const indexKey = `${JSON.stringify(indexSpec)}-${JSON.stringify(options)}`
  if (map.has(indexKey)) {
    await map.get(indexKey)
    return
  }
  const promise = createIndexWithRetry(collection, indexSpec, op)
  map.set(indexKey, promise)
  await promise
}
const createIndexWithRetry = async (
  collection: { readonly createIndex: Collection['createIndex']; collectionName: string },
  indexSpec: IndexSpecification,
  options?: CreateIndexesOptions,
) => {
  const log: typeof log1 = () => {}
  log('Creating index', { collection: collection.collectionName, indexSpec, options })
  while (true) {
    try {
      await collection.createIndex(indexSpec, options)
      log('Index created', { collection: collection.collectionName, indexSpec, options })
    } catch (e: any) {
      if ([85, 276].includes(e.code)) {
        // 85 index exists with different name, just ignore creating
        // 276 operation interrupted, it is ok
        log('Index created with different name', e.code, { collection: collection.collectionName, indexSpec, options })
        break
      }
      if (e.code == 12587) {
        // BackgroundOperationInProgressForNamespace, wait a bit then retry
        await new Promise(res => setTimeout(res, 300))
        continue
      }
      log('Error creating index', {
        collection: collection.collectionName,
        indexSpec,
        options,
        error: e,
      })
      console.error('Error creating index', e)
      throw e
    }
    break
  }
}
