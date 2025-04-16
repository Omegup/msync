import type { Collection, CreateIndexesOptions, IndexSpecification } from 'mongodb'

export const createIndex = async (
  collection: { readonly createIndex: Collection['createIndex'] },
  indexSpec: IndexSpecification,
  options?: CreateIndexesOptions,
) => {
  while (true) {
    try {
      await collection.createIndex(indexSpec, options)
    } catch (e: any) {
      if ([85, 276].includes(e.code)) {
        // 85 index exists with different name, just ignore creating
        // 276 operation interrupted, it is ok
        break
      }
      if (e.code == 12587) {
        // BackgroundOperationInProgressForNamespace, wait a bit then retry
        await new Promise(res => setTimeout(res, 300))
        continue
      }
      console.error('Error creating index', e)
      throw e
    }
    break
  }
}
