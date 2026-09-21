# @omegup/msync

[![npm](https://img.shields.io/npm/v/@omegup/msync)](https://www.npmjs.com/package/@omegup/msync)

`msync` keeps derived MongoDB data in sync with the documents it comes from.

You describe the derivation the way you would write an aggregation: project the fields you read, join, reshape, group, and write the result back. `msync` runs that description once over the existing data, then again on every change. Joins, sums, and counts update from the delta. A removed source undoes the write that depended on it. A changed source rewrites only the documents that depend on it.

## Install

```bash
npm install @omegup/msync
```

Peer runtime: MongoDB with change streams (a replica set), and TypeScript. `msync` enables change-stream pre- and post-images on every collection it watches.

```ts
import { Machine, from, staging } from '@omegup/msync'
```

## The principle

A stream is a named, typed function from source documents to stored documents.

1. **Sources are ordinary collections.** Every document `msync` reads or writes is a `Model`: it has `_id`, `touchedAt`, and `deletedAt`. `touchedAt` is the cluster time of the last write. `deletedAt: null` means the document is alive; a timestamp means it was removed. Deletes are soft, so a stream can see that a document went away and undo what it had written.

2. **You declare the slice you read.** A view is a collection plus a projection. The projection is the only data the rest of the pipeline is allowed to see, and the types follow it.

3. **Stages are valid as a full pass and as a delta.** `$lookup`, `$set`, `$replaceWith`, `$match`, and `$unwind` each know how to run over a snapshot and how to run over a before/after pair. You write them once.

4. **The last stage writes.** `$simpleMerge` and `$merge` patch fields onto an existing document. `$group` and `$groupId` fold many documents into one and keep the fold incremental. `$insert` creates documents in another collection and soft-deletes them when the source disappears.

5. **The name is the identity of the job.** Progress lives in a `__last` document keyed by that name. If the pipeline you registered under the name changes, `msync` tears the previous output down (unsets the fields it wrote, or soft-deletes the documents it inserted) and rebuilds.

6. **Streams compose by reading each other's fields.** A field whose name starts with `_` is treated as derived. A later stream that projects `_accountName` waits until that field exists, so you can add every stream to one machine and they still line up.

```
source collection
    │  change stream (pre-image + post-image)
    ▼
view  ── projection, optional match
    │
stages ── lookup, set, replace, match, unwind
    │
sink  ── merge | group | insert
    │
    ▼
same collection, or another one
```

Two ways in:

| | `from` | `staging` |
|---|---|---|
| Use it when | The current document is enough, and you patch it in place | You join, group, insert, or need the previous value |
| What it stores | The resume token in `__last` | A `{collection}_{name}_snapshot` of before/after, plus `__last` |
| Sink | `$simpleMerge`, `$simpleInsert` | `$merge`, `$group`, `$groupId`, `$insert` |
| Can be the right side of `$lookup` | | Yes, after `.get()` |

`single` builds the same snapshot pipeline without the watch loop, for a one-shot read.

## A document

```ts
import type { Model } from '@omegup/msync'

// Model is { _id, touchedAt, deletedAt? } intersected with your fields.
type Account = {
  _id: string
  name: string
  createdAt: Date
  _cohort?: string | null   // written by a stream, e.g. "2026-03"
} & Model
```

Your application sets `touchedAt` on every write (including its own updates) and sets `deletedAt` when it removes a document. `msync` does the same on the documents it creates. Bump `touchedAt` with the cluster time; streams resume from it.

Derived fields use a leading `_`. That is how a downstream stream knows the field is produced by an upstream one and should be waited for. Pass `needs: { plainField: 1 }` to wait on a field that does not use the prefix, or `needs: { _alreadyThere: 0 }` to read a `_` field without waiting.

## The shape of every stream

```ts
staging(view, 'unique-stream-name')
  .with($lookup({ /* join, needs the left-hand stream */ }))
  .then($replaceWith(/* reshape the current document */))
  .then($match(/* keep or drop */))
  .get()          // freeze the pipeline; also what $lookup expects as `from`
  .out($merge(/* ... */)(/* write */))
```

- `.with(fn)` wraps the stream so far. `$lookup` and `$outerLookup` are written this way, because a join has to see the left side.
- `.then(stage)` appends a stage that only sees the current document: `$set`, `$replaceWith`, `$match`, `$unwind`.
- `.get()` closes the pipeline.
- `.out(sink)` attaches the writer and returns a runner.

`from` has the same chain, and its stages are linear (`$set`, `$replaceWith`, `$match`). It has no snapshot, so it has no `$lookup`.

A projection entry is a pair, `[fieldName, 1]`, under the same name:

```ts
projection: {
  createdAt: ['createdAt', 1],
  regionId: ['regionId', 1],
}
```

A field expression is a pair too, `[fieldName, expr]`, inside `field({ ... })` and inside merge and group maps.

```ts
root<Account>().of('createdAt').expr()   // this document's field
val('-')                                  // a literal
concat(accountId, val('-'), planId)       // an expression
```

`root<T>()` is the current document, typed as `T`. `.of('key')` steps into a field. `.expr()` turns the path into a value you can pass to `concat`, `$sum`, `$merge`, and the rest.

## Tutorial

One small domain runs through every example: accounts place orders, and plans are sold per region. Each function takes the collections it touches and returns a runner. The runners are what you hand to a `Machine`.

### 1. Derive a field from the document itself

An account has `createdAt`. List pages want the cohort (`YYYY-MM`) without parsing dates on every read. Keep `_cohort` on the account, and refresh it when `createdAt` changes.

`from` is enough: there is no join and no previous value to subtract.

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

`$simpleMerge` writes `_cohort` onto the same `_id`. The document is already there, so a missing target fails the merge. The next change of `createdAt` rewrites that account only.

```
{ _id: "a1", createdAt: 2026-03-02 }   →   { _cohort: "2026-03" }
```

### 2. Copy a field across a reference

An order stores `accountId`. The account stores `name`. Reading an order should not look the account up again, and renaming an account should fix every order that points at it.

This needs `staging`. `$lookup` watches both sides: the order's `accountId`, and the account's `name`.

```ts
import type { Collection, Model, O, OPick, StrKey } from '@omegup/msync'
import { $lookup, $merge, root, staging } from '@omegup/msync'

type Account = O<{ _id: string; name: string }>
type Order = O<{ _id: string; accountId: string; total: number; _accountName?: string }>

type OrderView = OPick<Order & Model, '_id' | 'accountId'>
type AccountView = OPick<Account & Model, '_id' | 'name'>
type Joined = OrderView & { readonly account: AccountView }

export const makeOrderAccountNameStream = (
  orders: Collection<Order & Model>,
  accounts: Collection<Account & Model>,
) =>
  staging<Order & Model, StrKey<OrderView>>(
    {
      collection: orders,
      projection: { accountId: ['accountId', 1] },
    },
    'order-account-name',
  )
    .with(
      $lookup({
        as: 'account',
        from: staging(
          {
            collection: accounts,
            projection: { name: ['name', 1] },
          },
          'accounts-for-orders',
        ).get(),
        localField: root<OrderView>().of('accountId'),
        foreignField: root<AccountView>().of('_id'),
      }),
    )
    .get()
    .out(
      $merge<O<{ _accountName: string }>>()(orders, {
        _accountName: ['_accountName', root<Joined>().of('account').of('name').expr()],
      }),
    )
```

The inner `staging(...).get()` is a stream of its own, with its own snapshot. `$merge` patches `_accountName` back onto the order. A later stream that projects `_accountName` waits until this one has written it.

`$lookup` keeps documents that match. `$outerLookup` keeps the left document when the right side is missing, and types the joined field as `T | null`. A joined array is unwound into one row per match. Pass `toMany: true` when `localField` is an array and each match must keep its own id. Leave it off when the foreign field is `_id` and you want every match to keep the left `_id`, which is what a later `$groupId` folds on.

### 3. Keep a total on the parent

Each order has an `accountId` and a `total`. The account should store `_lifetimeSpend`, the sum of its orders, including orders that change or disappear.

`$groupId` folds into a document that already exists. The group key is that document's `_id`, here the account id. `$sum` is delta-aware: a new order adds its total, an edited order subtracts the old total and adds the new one, a deleted order subtracts. The account is never recomputed from scratch.

```ts
import type { Collection, Model, O } from '@omegup/msync'
import { $groupId, $sum, notNull, root, staging } from '@omegup/msync'

type Account = O<{ _id: string; _lifetimeSpend?: number }>
type Order = O<{ _id: string; accountId: string; total: number }>

export const makeAccountSpendStream = (
  orders: Collection<Order & Model>,
  accounts: Collection<Account & Model>,
) =>
  staging<Order & Model, '_id' | 'accountId' | 'total'>(
    {
      collection: orders,
      projection: {
        accountId: ['accountId', 1],
        total: ['total', 1],
      },
      match: notNull(root<Order>().of('accountId').expr()),
    },
    'account-lifetime-spend',
  )
    .get()
    .out(
      $groupId<Order, O<{ _lifetimeSpend: number }>, {}, Account & Model>(
        root<Order>().of('accountId').expr(),
        {
          _lifetimeSpend: ['_lifetimeSpend', $sum(root<Order>().of('total').expr())],
        },
        accounts,
        {},
      ),
    )
```

Read `$groupId` as four arguments:

1. The group key, a string expression. It must equal `_id` on the target.
2. Accumulators. Each value is `['field', accumulator]`. These fields are maintained incrementally on the target.
3. The target collection.
4. Extra fields, recomputed from the accumulator output on every update. `{}` when the accumulator value is already what you want to store.

`$group` is the same fold when the target document does not exist yet. It stores the key in `_grp` and inserts. Use it for a summary collection, such as revenue per month. Use `$groupId` to hang a summary on a document you already have, such as spend on an account.

When the thing you are counting is a set of strings rather than a number, use `$countDict`. It stores a map of string to count, drops keys whose count falls to zero, and pairs with `$keys` in the extra-fields argument to publish the surviving strings as an array. A product that references tag ids, joined to the tag's name and folded with `$countDict`, keeps `_tags` on the product this way. The [guide](docs/guide.md) shows that accumulator next to `$sum`.

### 4. Materialize a collection of pairs

Plans are sold per region. Every account in a region is entitled to every plan in that region. Each pair is its own document in `entitlements`, with `_id` of `accountId-planId`, so other streams can aggregate entitlements directly. When the plan's price changes, the entitlement updates. When the account or the plan goes away, the entitlement is soft-deleted.

`$replaceWith` builds the new document. `$insert` upserts it by `_id`, and on a deleted input it sets `deletedAt` on that `_id`.

```ts
import type { Collection, ID, Model, O, OPick } from '@omegup/msync'
import { $insert, $lookup, $replaceWith, concat, field, root, staging, val } from '@omegup/msync'

type Account = O<{ _id: string; regionId: string }>
type Plan = O<{ _id: string; regionId: string; price: number }>
type Entitlement = O<{
  _id: string
  accountId: string
  planId: string
  price: number
}>

export const makeEntitlementStream = (
  accounts: Collection<Account & Model>,
  plans: Collection<Plan & Model>,
  entitlements: Collection<Entitlement & Model>,
) => {
  type AccountView = OPick<Account & Model, keyof ID | 'regionId'>
  type PlanView = OPick<Plan & Model, keyof ID | 'regionId' | 'price'>
  type Joined = AccountView & { readonly plan: PlanView }

  return staging<Account & Model, keyof AccountView>(
    {
      collection: accounts,
      projection: { regionId: ['regionId', 1] },
    },
    'entitlements-from-accounts',
  )
    .with(
      $lookup({
        as: 'plan',
        from: staging(
          {
            collection: plans,
            projection: {
              regionId: ['regionId', 1],
              price: ['price', 1],
            },
          },
          'plans-for-entitlements',
        ).get(),
        localField: root<AccountView>().of('regionId'),
        foreignField: root<PlanView>().of('regionId'),
      }),
    )
    .then(
      $replaceWith(
        field<Entitlement, Joined>({
          _id: [
            '_id',
            concat(
              root<Joined>().of('_id').expr(),
              val('-'),
              root<Joined>().of('plan').of('_id').expr(),
            ),
          ],
          accountId: ['accountId', root<Joined>().of('_id').expr()],
          planId: ['planId', root<Joined>().of('plan').of('_id').expr()],
          price: ['price', root<Joined>().of('plan').of('price').expr()],
        }),
      ),
    )
    .get()
    .out($insert(entitlements))
}
```

Give inserted documents a deterministic `_id`. That id is how the next run finds the same row to update or retire. Joining on `regionId` (a field that is not `_id` on either side) yields one row per matching plan, and `$replaceWith` assigns the pair id before the insert.

## Run them together

A `Machine` merges runners and loops. Each tick reports which stream did the work.

```ts
import { Machine, prepare } from '@omegup/msync'

const client = await prepare() // connects with MONGO_URL, or use your own MongoClient
const db = client.db(process.env.MONGO_NAME)

const accounts = db.collection('accounts')
const orders = db.collection('orders')
const plans = db.collection('plans')
const entitlements = db.collection('entitlements')

const machine = new Machine()
machine.add(makeAccountCohortStream(accounts))
machine.add(makeOrderAccountNameStream(orders, accounts))
machine.add(makeAccountSpendStream(orders, accounts))
machine.add(makeEntitlementStream(accounts, plans, entitlements))

await machine.start(info => {
  console.log(new Date(), info.debug)
})
```

`.start` resolves only when it stops. Return `true` from the callback to stop after the current tick. Add streams in an order you can read — producers of `_` fields before the streams that project them — then let the machine run them side by side. The `_` prefix (and `needs`) is what makes a consumer skip a document until the producer has filled it.

Stream names are unique inside the process. Reusing a name from two different call sites throws. Pick a name that says what the stream maintains: `'account-cohort'`, `'order-account-name'`.

Split a large sync by area. Each area builds a `Machine` and returns it. The process adds every area and starts once:

```ts
const machine = new Machine()
machine.add(billing(client).runner())
machine.add(catalog(client).runner())
await machine.start(info => {
  console.log(new Date(), info.debug)
})
```

## Next

[docs/guide.md](docs/guide.md) is the rest of the language: expressions, predicates, accumulators, the write modes side by side, and what the process stores while it runs.
