import type { Db, Timestamp } from 'mongodb'
import type { O, ReadonlyCollection, StrKey, View } from '../types'
import { type Field } from './field'
import type { Model, Query } from './types'
import { log } from './utils'
import { mapExactToObject } from './utils/map-object'

export type OplogEntry = {
  ts: Timestamp // oplog timestamp
  ns: string // "db.collection"
  op: 'i' | 'u' | 'd' | 'c' | 'n'
  o: Record<string, unknown> // operation object
  o2?: Document // update query (for updates)
  wall?: Date
} & Document

type TailOptions = {
  since?: Timestamp
  reopenDelayMs?: number // delay before reopening if cursor ends
}
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const getCurrentTimestamp = async (db: Db): Promise<Timestamp> => {
  // Get the current timestamp from the server
  const adminDb = db.admin()
  const serverStatus = await adminDb.command({ serverStatus: 1 })
  return serverStatus['operationTime'] as Timestamp
}

async function getLastCommittedTs(adminDb: Db): Promise<Timestamp | null> {
  const st: any = await adminDb.command({ replSetGetStatus: 1 });
  return (st?.optimes?.lastCommittedOpTime?.ts as Timestamp) ?? null;
}

export async function waitUntilStablePast(
  db: Db,
  oplogTs: Timestamp,
  {
    pollMs = 0,
    timeoutMs = 10_000,
  }: { pollMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const adminDb = db.client.db('admin');
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const stable = await getLastCommittedTs(adminDb);
    if (stable && stable.comp(oplogTs) >= 0) return;

    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for stable timestamp to reach oplog event time");
    }
    await sleep(pollMs);
  }
}
export async function* tailOplog(
  db: Db, // this should be the "local" DB on a replica set member
  opts: TailOptions,
): AsyncGenerator<{ ns: string; fields: Set<string>; doc: OplogEntry }, never, void> {
  let lastTs = opts.since ?? (await getCurrentTimestamp(db))
  const reopenDelayMs = opts.reopenDelayMs ?? 250

  const coll = db.client.db('local').collection<OplogEntry>('oplog.rs')

  while (true) {
    const cursor = coll.find(
      {
        ts: { $gt: lastTs },
        ns: RegExp(`^${db.namespace}\\.(?!tmp_)(?!__).*(?<!_snapshot)$`),
        op: { $in: ['i', 'u'] },
      },
      {
        tailable: true,
        awaitData: true,
        noCursorTimeout: true,
      },
    )

    try {
      for await (const doc of cursor) {
        lastTs = doc.ts // checkpoint: resume after this
        if (doc.op === 'i') {
          yield { ns: doc.ns, fields: new Set(Object.keys(doc.o)), doc }
        } else {
          // doc.op is 'u'
          if (doc.o['$v'] !== 2) {
            throw new Error(`Expected update with $v: 2, got ${JSON.stringify(doc.o)}`)
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
          yield { ns: doc.ns, fields: new Set(updatedFields), doc }
        }
      }
    } catch (e) {
      log('oplog loop error', e)
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
  Map<string, { cb: (doc: OplogEntry) => void; keys: readonly string[] | null }>
>()
let running = false
const loop = async (db: Db) => {
  log('starting oplog loop')
  for await (const { ns, fields, doc } of tailOplog(db, {})) {
    log('oplog event', ns, doc.op, [...fields])
    const m = watchers.get(ns)
    if (!m) continue
    for (const { cb, keys } of m.values()) {
      if (!keys || keys.some(k => fields.has(k))) {
        cb(doc)
      }
    }
  }
}

const register = (
  coll: ReadonlyCollection<unknown>,
  keys: readonly string[] | null,
  cb: (doc: OplogEntry) => void,
) => {
  const ns = coll.namespace
  let m = watchers.get(ns)
  if (!m) watchers.set(ns, (m = new Map()))
  const id = crypto.randomUUID()
  m.set(id, { cb, keys })
  if (!running) {
    running = true
    loop(coll.s.db)
  }
  return () => {
    m!.delete(id)
    if (m!.size === 0) watchers.delete(ns)
  }
}

export const subQ = <D extends O, C, DeltaD extends O>(
  a: Query<D, C>,
  f: Field<DeltaD, D>,
): Query<DeltaD, C> => ({ raw: g => a.raw(g.with(f)) })

export const makeWatchStream = <V extends Model, K extends StrKey<V>>(
  { collection, projection: p, hardMatch: m }: View<V, K>,
  streamName: string,
) => {
  const projection = { ...(p ? mapExactToObject(p, v => v) : {}), deletedAt: 1 }

  let resolve = (_: OplogEntry) => {}
  const promise = new Promise<OplogEntry>(r => (resolve = r))
  const close = register(collection, p ? Object.keys(projection) : null, (doc) => {
    log(streamName, 'change detected', doc)
    resolve(doc)
    close()
  })

  return {
    tryNext: async () => {
      const doc = await promise
      // wait until the server’s lastStableRecoveryTimestamp / stable time has advanced past the oplog entry time
      const start = Date.now()
      await waitUntilStablePast(collection.s.db, doc.ts)
      log(streamName, 'stable past took', Date.now() - start)
      return doc
    },
    close: async () => close(),
  }
}
