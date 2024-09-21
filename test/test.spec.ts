import { $sum } from '../lib/accumulators'
import { $merge, type Merge } from '../lib/aggregate/$merge'
import { $group } from '../lib/aggregate/group'
import { $set } from '../lib/aggregate/set'
import { from, staging } from '../lib/boot'
import { concat } from '../lib/expression/concat'
import { val } from '../lib/expression/val'
import { root } from '../lib/field'
import { Machine, wrap } from '../lib/machine'
import { $lookup, type LeftWrite } from '../lib/stream/$lookup'
import type { Model } from '../lib/types'
import { set, to } from '../lib/update'
import type { ID, O, RORec, Rec } from '../types'
import { prepare } from './mongo'

const client = await prepare('test')
const db = client.db('msync')
type D1 = O<ID & { readonly link: string }>
type D2 = O<ID & { readonly link: string; readonly link2: string }>
type D3 = O<ID & { readonly link2: string }>
type V = D1 & RORec<'v', number>
const v = db.collection<V & Model>('v')
const c1 = db.collection<D1 & Model>('c1')
const c2 = db.collection<D2 & Model>('c2')
const c3 = db.collection<D3 & Model>('c3')
// const r = db.collection<Merge<D1>>('r')
const g = db.collection<Merge<ID & Rec<'v', number>>>('g')
// const r2 = db.collection<Merge<LeftWrite<D1, D2>>>('r2')
const r3 = db.collection<Merge<LeftWrite<LeftWrite<D1, D2>, D3>>>('r3')
const r4 = db.collection<Merge<LeftWrite<LeftWrite<D1, D2>, D3>>>('r4')

let machine1 = new Machine()
machine1.add(
  staging<D1>({ collection: c1, projection: { _id: 1, deletedAt: 1, link: 1 } }, 'q1')
    .with(
      $lookup({
        right: staging<D2, D2 & Model>(
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
        right: staging<D3, D3 & Model>(
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
    .out($merge(r3)),
)

machine1 = wrap(machine1)

machine1.add(
  from<LeftWrite<LeftWrite<D1, D2>, D3>>(
    { collection: r3, projection: { _id: 1, deletedAt: 1, left: 1, right: 1 } },
    'xs1',
  )
    .get()
    .out($merge(r4)),
)

machine1.start(console.log)

const machine2 = new Machine()

machine2.add(
  from<V>({ collection: v, projection: { _id: 1, deletedAt: 1, link: 1, v: 1 } }, 's1')
    .then($set(set({ link: to(concat(root<V>().of('link').expr(), val('..'))) })))
    .with($group(root<V>().of('link').expr(), { v: $sum(root<V>().of('v').expr()) }))
    .get()
    .out($merge(g)),
)

machine2.start(console.log)
