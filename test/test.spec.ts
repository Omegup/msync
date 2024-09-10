import { $mergeDelta, type Merge } from '../lib/aggregate/$merge-delta'
import { from, type TS } from '../lib/boot'
import { root } from '../lib/field'
import { $lookup, type LeftWrite } from '../lib/stream/$lookup'
import type { O } from '../types'
import { prepare, run } from './mongo'

const client = await prepare('test')
const db = client.db('msync')
type D1 = O<{ _id: string; link: string }>
type D2 = O<{ _id: string; link: string }>
const c1 = db.collection<D1 & TS>('c1')
const c2 = db.collection<D2 & TS>('c2')
const r = db.collection<Merge<D1>>('r')
const r2 = db.collection<Merge<LeftWrite<D1, D2>>>('r2')

const stream = from<D1, D1 & TS>(
  { collection: c1, projection: { _id: 1, deletedAt: 1, link: 1 } },
  'q1',
)
  .with(
    $lookup({
      right: from<D2, D2 & TS>(
        {
          collection: c2,
          projection: { _id: 1, deletedAt: 1, link: 1 },
        },
        'q2',
      ).get(),
      lField: root<D1>().of('link'),
      rField: root<D2>().of('link'),
    }),
  )
  .get()
  .run($mergeDelta(r2))

run(stream)
