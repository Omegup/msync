# Run them together

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

The [guide](/guide) is the rest of the language: expressions, predicates, accumulators, the write modes side by side, and what the process stores while it runs.
