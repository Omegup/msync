import { $mergeDelta, type Merge } from '../lib/aggregate/$merge-delta'
import { from, type TS } from '../lib/boot'
import { root } from '../lib/field'
import { $lookup, type LeftWrite } from '../lib/stream/$lookup'
import type { O } from '../types'
import { prepare, run } from './mongo'

const client = await prepare('test')
const db = client.db('msync')
type D1 = O<{ _id: string; link: string }>
type D2 = O<{ _id: string; link: string; link2: string }>
type D3 = O<{ _id: string; link2: string }>
const c1 = db.collection<D1 & TS>('c1')
const c2 = db.collection<D2 & TS>('c2')
const c3 = db.collection<D3 & TS>('c3')
const r = db.collection<Merge<D1>>('r')
const r2 = db.collection<Merge<LeftWrite<D1, D2>>>('r2')
const r3 = db.collection<Merge<LeftWrite<LeftWrite<D1, D2>, D3>>>('r3')

const stream = from<D1, D1 & TS>(
  { collection: c1, projection: { _id: 1, deletedAt: 1, link: 1 } },
  'q1',
)
  .with(
    $lookup({
      right: from<D2, D2 & TS>(
        {
          collection: c2,
          projection: { _id: 1, deletedAt: 1, link: 1, link2: 1 },
        },
        'q2',
      ).get(),
      lField: root<D1>().of('link'),
      rField: root<D2>().of('link'),
    }),
  )
  .with(
    $lookup({
      right: from<D3, D3 & TS>(
        {
          collection: c3,
          projection: { _id: 1, deletedAt: 1, link2: 1 },
        },
        'q3',
      ).get(),
      lField: root<LeftWrite<D1, D2>>().of('right').of('link2'),
      rField: root<D3>().of('link2'),
    }),
  )
  .get()
  .run($mergeDelta(r3))

run(stream)
