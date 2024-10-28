import { $sumDelta } from '../lib/accumulators'
import { $replace, type Merge } from '../lib/aggregate/$replace'
import { $groupMerge } from '../lib/aggregate/group/$group-merge'
import { $set } from '../lib/aggregate/set'
import { from, staging } from '../lib/boot'
import { concat } from '../lib/expression/concat'
import { val } from '../lib/expression/val'
import { root } from '../lib/field'
import { Machine, wrap } from '../lib/machine'
import { $lookup } from '../lib/stream/$lookup'
import type { Model, TS } from '../lib/types'
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
const g = db.collection<ID & TS & Rec<'_grp', string> & Rec<'v', number>>('g')
// const r2 = db.collection<Merge<LeftWrite<D1, D2>>>('r2')
const r3 = db.collection<Merge<D1 & RORec<'d2', D2 & RORec<'d3', D3>>>>('r3')
const r4 = db.collection<Merge<D1 & RORec<'d2', D2 & RORec<'d3', D3>>>>('r4')

let machine1 = new Machine()

machine1.add(
  staging<D1>(
    { collection: c1, projection: { _id: '_id', deletedAt: 'deletedAt', link: 'link' } },
    'q1',
  )
    .with<D1, D1 & RORec<'d2', D2 & RORec<'d3', D3>>>(
      $lookup<'d2', D1, D2, D2 & RORec<'d3', D3>, string>({
        as: 'd2',
        from: staging<D2>(
          {
            collection: c2,
            projection: { _id: '_id', deletedAt: 'deletedAt', link: 'link', link2: 'link2' },
          },
          'q2',
        )
          .with<D2, D2 & RORec<'d3', D3>>(
            $lookup<'d3', D2, D3, D3, string>({
              from: staging<D3, D3 & Model>(
                {
                  collection: c3,
                  projection: { _id: '_id', deletedAt: 'deletedAt', link2: 'link2' },
                },
                'q3',
              ).get(),
              localField: root<D2>().of('link2'),
              foreignField: root<D3>().of('link2'),
              as: 'd3',
            }),
          )
          .get(),
        localField: root<D1>().of('link'),
        foreignField: root<D2>().of('link'),
      }),
    )
    .get()
    .out($replace(r3)),
)

machine1 = wrap(machine1)

machine1.add(
  from<D1 & RORec<'d2', D2 & RORec<'d3', D3>>>(
    { collection: r3, projection: { _id: '_id', deletedAt: 'deletedAt', d2: 'd2', link: 'link' } },
    'xs1',
  )
    .get()
    .out($replace(r4)),
)

machine1.start(console.log)

const machine2 = new Machine()

machine2.add(
  staging<V>(
    { collection: v, projection: { _id: '_id', deletedAt: 'deletedAt', link: 'link', v: 'v' } },
    's1',
  )
    .then(
      $set(set({ link: ['link', to(concat(root<V>().of('link').expr(), val('..')))] as const })),
    )
    .get()
    .out(
      $groupMerge<V, string, O<{ readonly v: number }>>(
        root<V>().of('link').expr(),
        {
          v: ['v', $sumDelta(root<V>().of('v').expr())],
        },
        g,
      ),
    ),
)

machine2.start(console.log)
