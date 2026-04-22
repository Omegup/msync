import { type Db, Timestamp } from 'mongodb'
import type { O, ReadonlyCollection, StrKey, View } from '../types'
import type { Field } from './field'
import type { Del, Model, Query } from './types'
import { log } from './utils'
import { mapExactToObject } from './utils/map-object'

export type OplogEntry = {
  ts: Timestamp // oplog timestamp
  ns: string // "db.collection"
  op: 'i' | 'u' | 'd' | 'c' | 'n'
  o: Record<string, unknown> // operation object
  o2?: { _id: string } // update query (for updates)
  wall?: Date
} & Document

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const maxTimestamp = new Timestamp(0xffffffffffffffffn)

export const getCurrentTimestamp = async (db: Db): Promise<Timestamp> => {
  // Get the current timestamp from the server
  const adminDb = db.admin()
  const serverStatus = await adminDb.command({ serverStatus: 1 })
  return serverStatus['operationTime'] as Timestamp
}

async function getLastCommittedTs(adminDb: Db): Promise<Timestamp | null> {
  const st: any = await adminDb.command({ replSetGetStatus: 1 })
  return (st?.optimes?.lastCommittedOpTime?.ts as Timestamp) ?? null
}

export async function waitUntilStablePast(
  db: Db,
  oplogTs: Timestamp,
  { pollMs = 0, timeoutMs = 10_000 }: { pollMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const adminDb = db.client.db('admin')
  const deadline = Date.now() + timeoutMs

  while (true) {
    const stable = await getLastCommittedTs(adminDb)
    if (stable && stable.comp(oplogTs) >= 0) return

    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for stable timestamp to reach oplog event time')
    }
    await sleep(pollMs)
  }
}
type Event = { fields: Set<string>; doc: OplogEntry }
export async function* tailOplog(db: Db): AsyncGenerator<Event | null, never, void> {
  let lastTs = await getCurrentTimestamp(db)
  const reopenDelayMs = 250

  const coll = db.client.db('local').collection<OplogEntry>('oplog.rs')

  while (true) {
    const cursor = coll.find(
      {
        ts: { $gt: lastTs },
        $or: [
          {
            ns: RegExp(`^${db.namespace}\\.(?!tmp_)(?!__).*(?<!_snapshot)$`),
            op: { $in: ['i', 'u'] },
          },
          {
            ns: 'admin.$cmd',
            op: 'c',
            'o.applyOps': {
              $elemMatch: {
                ns: RegExp(`^${db.namespace}\\.(?!tmp_)(?!__).*(?<!_snapshot)$`),
                op: { $in: ['i', 'u'] },
              },
            },
          },
        ],
      },
      {
        tailable: true,
        awaitData: true,
        noCursorTimeout: true,
      },
    )

    try {
      for await (const docs of cursor) {
        for (const doc of docs.op === 'c' ? (docs.o['applyOps'] as OplogEntry[]) : [docs]) {
          doc.ts = docs.ts
          if (doc.op === 'i' || '_id' in doc.o) {
            const fields = new Set(Object.keys(doc.o))
            fields.delete('_id')
            yield { fields, doc }
          } else {
            // doc.op is 'u'
            if (doc.o['$v'] !== 2) {
              throw new Error(`Expected update with $v: 2, got ${JSON.stringify(doc)}`)
            }
            const updatedFields = []
            const diff = doc.o['diff'] as Record<string, unknown>
            for (const updateOp in diff) {
              if ((['u', 'i', 'd'] as const).includes(updateOp)) {
                updatedFields.push(...Object.keys(diff[updateOp] as Record<string, unknown>))
              } else if (updateOp.startsWith('s')) {
                updatedFields.push(updateOp.slice(1))
              }
            }
            yield { fields: new Set(updatedFields), doc }
          }
        }
      }
    } catch (e) {
      log('oplog loop error, notifying watchers and reopening')
      console.error(e)
      lastTs = await getCurrentTimestamp(db)
      yield null
      // swallow and reopen; caller can add their own logging around consumption
    } finally {
      log('oplog loop ended')
      await cursor.close().catch(() => {})
    }

    await sleep(reopenDelayMs)
  }
}

const watchers = new Map<
  string,
  Map<
    string,
    {
      cb: (doc: OplogEntry | null) => void
      keys: readonly string[] | null
      match: Query<never> | undefined
      rem: () => void
    }
  >
>()
let running = false

const makePromise = <T>() => {
  let resolve: (val: T) => void = () => {}
  let promise = new Promise<T>(r => (resolve = r))
  return { promise, resolve }
}

const loop = async (db: Db) => {
  log('starting oplog loop')
  let notify = makePromise<void>()
  let batch: Event[] | null = []
  const run = async () => {
    for await (const event of tailOplog(db)) {
      if (event?.fields.size === 0) continue
      batch = event && batch ? [...batch, event] : null
      notify.resolve()
    }
  }
  run()
  const iter = async function* () {
    while (true) {
      await notify.promise
      const b = batch
      batch = []
      notify = makePromise()
      yield b
    }
  }
  for await (const events of iter()) {
    if (!events) {
      log('notifying watchers of oplog loop restart')
      for (const m of watchers.values()) {
        for (const { cb } of [...m.values()]) {
          cb(null)
        }
      }
      continue
    }
    for (const { fields, doc } of events) {
      const m = watchers.get(doc.ns)
      if (!m) continue
      for (const { cb, keys, rem, match } of [...m.values()]) {
        if (!keys || (doc.op === 'i' ? (match ? true : true) : keys.some(k => fields.has(k)))) {
          cb(doc)
          rem()
        }
      }
    }
  }
}

const register = <V extends O>(
  coll: ReadonlyCollection<V | Del>,
  keys: readonly string[] | null,
  match: Query<V> | undefined,
  cb: (doc: OplogEntry | null) => void,
) => {
  const ns = coll.namespace
  let m = watchers.get(ns)
  if (!m) watchers.set(ns, (m = new Map()))
  const id = crypto.randomUUID()
  const rem = () => {
    m!.delete(id)
    if (m!.size === 0) watchers.delete(ns)
  }
  m.set(id, { cb, keys, match, rem })
  if (!running) {
    running = true
    loop(coll.s.db)
  }
  return rem
}

export const subQ = <D extends O, C, DeltaD extends O>(
  a: Query<D, C>,
  f: Field<DeltaD, D>,
): Query<DeltaD, C> => ({ raw: g => a.raw(g.with(f)) })

let maxKeysRemoved: Promise<void> | null = null

export const makeWatchStream = async <V extends Model, K extends StrKey<V>>(
  { collection, projection: p, hardMatch: m }: View<V, K>,
  streamName: string,
) => {
  const { db } = collection.s
  await (maxKeysRemoved ??= Promise.all(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      x =>
        void db
          .collection(x.name)
          .updateMany({ touchedAt: maxTimestamp }, [{ $set: { touchedAt: '$$CLUSTER_TIME' } }]),
    ),
  ).then(() => {}))

  const projection = { ...(p ? mapExactToObject(p, v => v) : {}), deletedAt: 1 }

  let notify = makePromise<OplogEntry | null>()
  register(collection, p ? Object.keys(projection) : null, m, doc => {
    log(streamName, 'change detected', doc)
    notify.resolve(doc)
  })

  return {
    tryNext: async () => {
      const doc = await notify.promise
      // wait until the server’s lastStableRecoveryTimestamp / stable time has advanced past the oplog entry time
      const start = Date.now()
      if (doc) await waitUntilStablePast(collection.s.db, doc.ts)
      log(streamName, 'stable past took', Date.now() - start)
      return doc ?? {}
    },
    close: async () => {},
  }
}
