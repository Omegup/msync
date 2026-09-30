# Getting started

`msync` keeps derived MongoDB data in sync with the documents it comes from. You describe the derivation as an aggregation. The library runs that description once over the existing data, then again on every change.

## Install

```bash
npm install @omegup/msync
```

You need MongoDB with change streams, which means a replica set, and TypeScript. `msync` enables change-stream pre- and post-images on every collection it watches.

```ts
import { Machine, from, staging } from '@omegup/msync'
```

## What a document looks like

Every document `msync` reads or writes is a `Model`: `_id`, `touchedAt`, and `deletedAt`. `touchedAt` is the cluster time of the last write. `deletedAt: null` means the document is alive. A timestamp means it was removed. Deletes are soft, so a stream can see that a document went away and undo what it had written.

Your application sets `touchedAt` on every write and sets `deletedAt` when it removes a document. `msync` does the same on the documents it creates.

Derived fields use a leading `_`. A later stream that projects `_accountName` waits until that field exists. Pass `needs: { plainField: 1 }` to wait on a field that does not use the prefix, or `needs: { _alreadyThere: 0 }` to read a `_` field without waiting.

## Two ways in

| | `from` | `staging` |
|---|---|---|
| Use it when | The current document is enough, and you patch it in place | You join, group, insert, or need the previous value |
| What it stores | The resume token in `__last` | A `{collection}_{name}_snapshot` of before/after, plus `__last` |
| Sink | `$simpleMerge`, `$simpleInsert` | `$merge`, `$group`, `$groupId`, `$insert` |
| Can be the right side of `$lookup` | | Yes, after `.get()` |

`single` builds the same snapshot pipeline without the watch loop, for a one-shot read.

## A first stream

An account has `createdAt`. List pages want the cohort (`YYYY-MM`) stored on the account. There is no join and no previous value, so `from` is enough.

```ts
import type { Collection, Model, N, O } from '@omegup/msync'
import { $simpleMerge, from, monthPart, root } from '@omegup/msync'

type Account = O<{
  _id: string
  name: string
  createdAt: Date
  _cohort: string | N
}>

export const makeAccountCohortStream = (accounts: Collection<Account & Model>) =>
  from(
    {
      collection: accounts,
      projection: { createdAt: ['createdAt', 1] },
    },
    'account-cohort',
  )
    .get()
    .out(
      $simpleMerge<O<{ _cohort: string }>>()(accounts, {
        _cohort: ['_cohort', monthPart(root<Account>().of('createdAt').expr())],
      }),
    )
```

A projection entry is a pair, `[fieldName, 1]`. A field written by a sink is a pair too, `[fieldName, expr]`.

`$simpleMerge` writes `_cohort` onto the same `_id`. The next change of `createdAt` rewrites that account only.

## Run it

```ts
import { Machine, prepare } from '@omegup/msync'

const client = await prepare() // connects with MONGO_URL
const db = client.db(process.env.MONGO_NAME)
const accounts = db.collection('accounts')

const machine = new Machine()
machine.add(makeAccountCohortStream(accounts))

await machine.start(info => {
  console.log(new Date(), info.debug)
})
```

`.start` resolves only when it stops. Return `true` from the callback to stop after the current tick.

Stream names are unique inside the process. Reusing a name throws. The [tutorial](./tutorial/index.md) continues from here with a lookup, a sum, and a collection of pairs. The [guide](./guide.md) is the rest of the language.
