import { $merge, type Merge } from '../lib/aggregate/$merge'
import { $set } from '../lib/aggregate/set'
import { from, simple } from '../lib/boot'
import { concat } from '../lib/expression/concat'
import { val } from '../lib/expression/val'
import { root } from '../lib/field'
import { $lookup, type LeftWrite } from '../lib/stream/$lookup'
import type { Model, SimpleStream } from '../lib/types'
import { set, to } from '../lib/update'
import type { ID, O, RORec } from '../types'
import { prepare, run } from './mongo'

const client = await prepare('test')
const db = client.db('msync')
type D1 = O<ID & { readonly link: string }>
type D2 = O<ID & { readonly link: string; readonly link2: string }>
type D3 = O<ID & { readonly link2: string }>
const c1 = db.collection<D1 & RORec<'v', number> & Model>('c1')
const c2 = db.collection<D2 & Model>('c2')
const c3 = db.collection<D3 & Model>('c3')
const r = db.collection<Merge<D1>>('r')
// const r2 = db.collection<Merge<LeftWrite<D1, D2>>>('r2')
const r3 = db.collection<Merge<LeftWrite<LeftWrite<D1, D2>, D3>>>('r3')

const stream = from<D1>({ collection: c1, projection: { _id: 1, deletedAt: 1, link: 1 } }, 'q1')
  .with(
    $lookup({
      right: from<D2, D2 & Model>(
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
      right: from<D3, D3 & Model>(
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
  .out($merge(r3))

run(stream)

const stream2 = simple<D1>({ collection: c1, projection: { _id: 1, deletedAt: 1, link: 1 } }, 's1')
  .then($set(set({ link: to(concat(root<D1>().of('link').expr(), val('..'))) })))
  .with((a: SimpleStream<Model & D1>) => a)
  .get()
  .out($merge(r))

run(stream2)
