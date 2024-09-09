import { $mergeDelta, type Merge } from '../lib/aggregate/$merge-delta'
import { link } from '../lib/aggregate/prefix'
import { from, type TS } from '../lib/boot'
import type { Delta } from '../lib/types'
import type { App, HKT, J, O } from '../types'
import { prepare, run } from './mongo'

const client = await prepare('test')
const db = client.db('msync')
type D1 = O<{ _id: string; link: string }>
type D2 = O<{ _id: string; link: string }>
const c1 = db.collection<D1 & TS>('c1')
const c2 = db.collection<D2 & TS>('c2')
const r = db.collection<Merge<D1>>('r')

const t = from<D1, D1 & TS>({ collection: c1, projection: { _id: 1, deletedAt: 1, link: 1 } }, 'n1')

const stream = t({
  delta: link<Delta<D1>>().stages,
  raw: <F extends HKT<J>>() => link<App<F, D1>>().stages,
}).run($mergeDelta(r))

run(stream)
