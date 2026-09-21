# Guide

This is the rest of `@omegup/msync` after the [README](../README.md). The README walks the four pipelines you will write most often, on accounts, orders, and plans. Here is how the pieces fit, and what the process stores while they run.

## Views

`from` and `staging` both start from a view:

```ts
staging(
  {
    collection,          // MongoDB collection of Model documents
    projection,          // { field: ['field', 1], ... }  — the slice this stream may read
    match,               // optional Expr<boolean> — applied while catching up from scratch
    hardMatch,           // optional Query — always applied, and used as a partial index filter
    needs,               // optional { field: 0 | 1 } — override the "_" wait rule
  },
  'stream-name',
)
```

`projection: null` keeps every field. Prefer a real projection. It is both the runtime filter and the type of every later stage.

`match` is an expression, built with `root`, `notNull`, `eq`, `and`, `or`. It selects which documents enter the stream on a fresh start.

```ts
match: notNull(root<Order>().of('accountId').expr())
```

`hardMatch` is a MongoDB query predicate (`field.has($eq(...))`, combined with `$and` / `$or` / `$nor`). It also becomes the partial filter of the `touchedAt` index `msync` creates, so keep it selective and stable.

### Waiting on derived fields

For every projected field, the stream requires the field to exist when either of these holds:

- the field name starts with `_`, or
- `needs[field] === 1`

`needs[field] === 0` turns the wait off for that field, including `_` fields. This is how streams chain. The account-name stream writes `_accountName` onto orders. The next stream projects `_accountName` and therefore only sees orders that already have it.

## Building the pipeline

```ts
staging(view, name)
  .with(join)     // (stream) => stream     — $lookup, $outerLookup
  .then(stage)    // a stage value          — $set, $replaceWith, $match, $unwind
  .get()          // SnapshotStreamExecutionResult, or the simple equivalent for `from`
  .out(sink)      // a runner: () => { next, stop, clear }
```

`.with` rebuilds the stream by passing the current stream into a function. Lookups are functions of the left stream, so they go in `.with`.

`.then` concatenates a stage onto the document currently flowing. After a `$lookup({ as: 'account' })`, the document type grows an `account` field, and the next `.then` sees it.

`.get()` on a `staging` pipeline is also a legal `from` for another `$lookup`. Give that inner pipeline its own stream name. It gets its own snapshot and its own `__last` entry.

Further stages belong on the pipe before `.get()`. A lookup consumes a pipeline that has already been closed with `.get()`.

### `from`, `staging`, `single`

`from(view, name)` reads the collection through a change stream and runs a linear pipeline. Use it when the output is a function of the current document alone and you write it back with `$simpleMerge` or `$simpleInsert`. There is no snapshot collection.

`staging(view, name)` maintains `{collection}_{name}_snapshot`. Each snapshot row holds `before` (the last committed value), `after` (the value being applied), and `updated`. Downstream stages receive a delta: what the document was, and what it is. That is what makes joins and aggregations incremental. Deleting a source produces a delta whose `after` is null, and the sink undoes the previous write.

`single(view)` is the snapshot pipeline as stages, with no watch loop and no `__last`. Use it when you want the same description for a one-shot aggregation.

## Expressions

An `Expr<T, Doc>` is a value of type `T` in the context of `Doc`. You combine typed builders. The aggregation JSON they lower to stays inside the library.

### Paths and literals

```ts
root<Account>().of('address').of('city').expr()
val(1)
val('-')
nil                      // null
current                  // cluster time, as a Timestamp expression
```

`root<T>()` is `$$ROOT` typed as `T`. `ctx<T>()('name')` is a `let` variable `$$name`, used inside merge stages that bind `new` and inside `$map`.

### Objects

`field` builds a document expression. Every entry is `[outputKey, expr]`, and the output key matches the property name:

```ts
field({
  _id: ['_id', concat(accountId, val('-'), planId)],
  price: ['price', root<Joined>().of('plan').of('price').expr()],
})
```

### Strings, numbers, logic

| Builder | Meaning |
|---|---|
| `concat(...strings)` | `$concat` |
| `str(expr)` | `$toString` |
| `eq(a)(b)`, `ne(a)(b)` | equality |
| `and(...)`, `or(...)`, `not(expr)` | boolean combinators |
| `ite(cond, then, else)` | `$cond` |
| `notNull(expr)` | present and not null |
| `$ifNull(expr, fallback)` | `$ifNull` |
| `add`, `subtract`, and the other arithmetic builders | `$add`, `$subtract`, … |
| `year(date)`, `dayAndMonthPart(date)`, `monthPart`, `weekPart`, `datePart` | date pieces |
| `dateAdd(date, amount, unit)` | `$dateAdd` |

Comparisons against query operators (`$eq`, `$gt`, `$gte`, `$exists`, `$in`, …) are for `hardMatch` and `field.has(predicate)`, which produces a MongoDB query rather than an expression. `$expr(expression)` turns an expression into a query when you need it in that position. `$match(expression)` is the pipeline stage, and it takes the expression form.

### Arrays

```ts
size(expr)
array(a, b, c)                 // a literal array of expressions
concatArray(a, b)
filter({ expr, as, cond })
$map(expr, item => concat(item, val('_'), other))
inArray(item, arrayExpr)
```

`$map` binds each element as the expression you receive. Folding a list of tag ids into countable keys looks like this:

```ts
$countDictArray(
  $map(root<Product>().of('tagIds').expr(), tagId =>
    concat(root<Product>().of('catalogId').expr(), val('_'), tagId),
  ),
)
```

## Stages

### `$set` and `$replaceWith`

`$set<Patch>()({ field: ['field', to(expr)] })` writes keys onto the current document and leaves the rest in place.

```ts
$set<O<{ _cohort: string }>>()({
  _cohort: ['_cohort', to(monthPart(root<Account>().of('createdAt').expr()))],
})
```

`$replaceWith(field({ ... }))` replaces the document. Use it when the output shape is a different collection's document, or when you want one row per joined element before a group. Keep `_id` unless you are about to assign a new one, as the entitlement stream does.

Both exist as delta stages, so they are legal in `staging` and in `from`.

### `$match`

```ts
$match(eq(root<Order>().of('status').expr())(val('open')))
```

Drops documents for which the expression is false. On a delta, a document that stops matching is handled as a removal, so downstream sinks undo it.

### `$lookup` and `$outerLookup`

```ts
$lookup({
  as: 'account',
  to: 'one',
  from: accountsStage, // a staging(...).get()
  localField: root<Order>().of('accountId'),
})
```

`from` must be a `staging` pipeline's `.get()`. The joined value is added under `as`, then unwound, so each match is its own row.

`$lookup` is an inner join: a left document with no match produces nothing. `$outerLookup` keeps the left document and types `as` as `Right | null`.

The join watches both sides. A change to the account updates every order that points at it, and a change to `accountId` re-runs the join from the order. `msync` indexes `before.<join field>` on both snapshot collections to make that lookup cheap.

The arguments are a union:

| | `to: 'one'` | `to: 'many'` |
|---|---|---|
| When | `localField` is the other collection's `_id` | Several right rows per left row, or the join key is not `_id` |
| Fields | `localField` only. The foreign field is `_id` | `localField` and `foreignField` |
| Row `_id` | The left `_id` | `left._id + middle + right._id` |
| `middle` | Forbidden | Required |

```ts
$lookup({
  as: 'plan',
  to: 'many',
  middle: '-',
  from: plansStage,
  localField: root<Account>().of('regionId'),
  foreignField: root<Plan>().of('regionId'),
})
```

That row's `_id` is already `accountId-planId`. Later stages copy `root().of('_id')`. They do not concatenate the two ids again. If you still need the original left `_id` as its own field, copy it with `$set` before the lookup, because the composite id replaces `_id`.

An array `localField` is `to: 'many'`: one left document matches many right documents, so those rows cannot share the left `_id`. Pass `middle`.

### `$unwind`

`$unwind` expands an array field into one document per element and gives each element a stable join id, so a later group can tell insertions and removals of elements apart. The signature takes the array's key and a small rename map (`{ [key]: 'key', _id: 'id' }`) that `$unwind` uses while rebuilding the document. Reach for it when you need one output row per array element and a lookup is the wrong shape.

## Sinks

Every `.out(...)` argument is a `StreamRunnerParam`: a `raw` pipeline that must end in a write, plus a `teardown` that knows how to remove what this sink wrote. You call the helpers below.

| Helper | Pipe | Target document | On delete of the source |
|---|---|---|---|
| `$simpleMerge` | `from` | Same `_id`, fields patched | The document drops out of the stream; fields already written stay on it |
| `$merge` | `staging` | Same `_id` (taken from `before._id`), fields patched | Written fields are unset |
| `$groupId` | `staging` | Existing doc whose `_id` equals the group key | That member is subtracted from the accumulator |
| `$group` | `staging` | Doc stored under `_grp` = group key, inserted if missing | That member is subtracted from the accumulator |
| `$insert` | `staging` | Doc whose `_id` you set in `$replaceWith` | `deletedAt` is set on that `_id` |
| `$simpleInsert` | `from` | Inserts the current document | Teardown soft-deletes rows this stream owns |

### `$simpleMerge` and `$merge`

Both take a patch type and a map of `['field', expr]`.

```ts
$simpleMerge<O<{ _cohort: string }>>()(accounts, {
  _cohort: ['_cohort', monthPart(root<Account>().of('createdAt').expr())],
})

$merge<O<{ _accountName: string }>>()(orders, {
  _accountName: ['_accountName', root<Joined>().of('account').of('name').expr()],
})
```

`$simpleMerge` runs on the current document (`from`). `$merge` runs on a delta (`staging`) and addresses the target by the id the document had before this change, so an id-preserving update still finds the row.

`$simpleMerge` accepts `'fail' | 'discard'` as the match mode when the target `_id` is missing. The default is `'fail'`, which is what you want when you are decorating a document that already exists.

### `$groupId` and `$group`

```ts
$groupId<Source, Accumulated, Extra, Target>(
  idExpression,     // Expr<string, Source> — becomes the target _id
  accumulators,     // { field: ['field', deltaAccumulator] }
  targetCollection,
  extra,            // { field: ['field', expr over the accumulated doc] }
)

$group<Source, GroupKey, Accumulated, Extra, Target>(
  idExpression,     // Expr<GroupKey, Source> — stored as _grp
  accumulators,
  targetCollection, // missing groups are inserted
  extra,
  idPrefix?,        // optional string prepended while building stored ids
)
```

Accumulators live on the target and survive from tick to tick. Extra fields are recomputed from the accumulator values whenever the group changes. A sum can be stored directly, as `_lifetimeSpend` is. A multiset is easier to query as an array, so the accumulator holds the map and `extra` publishes the keys:

```ts
$groupId<
  Product,
  O<{ readonly _tagCounts: Rec<string, number> }>,
  { _tags: Arr<string> },
  Product & Model
>(
  root<Product>().of('_id').expr(),
  {
    _tagCounts: ['_tagCounts', $countDict(root<Tagged>().of('tagName').expr())],
  },
  products,
  {
    _tags: [
      '_tags',
      $keys(root<O<{ _tagCounts: Rec<string, number> }>>().of('_tagCounts').expr()),
    ],
  },
)
```

`$groupId` refuses to insert. The group key must already be the `_id` of a document in the target. `$group` inserts, and the group's identity is `_grp` plus the optional prefix, so many groups can live in a collection that does not already contain them. Revenue per month is that shape: the group key is `monthPart(placedAt)`, the accumulator is `$sum(total)`, and the target is a `monthlyRevenue` collection.

### `$insert`

```ts
.get().out($insert(entitlements))
```

The document in the pipeline must already have the stored shape, including `_id`. Build it with `$replaceWith(field({...}))`. `$insert` sets `deletedAt: null` and `touchedAt` to the cluster time on insert, and sets `deletedAt` when the delta's `after` is null.

The `_id` you insert is the one the lookup wrote from `middle`. The same account and the same plan always map to the same id. A random id would insert a new row on every pass.

## Accumulators

Ordinary MongoDB `$sum` forgets how it got there. A delta accumulator knows three things: the new contribution, the previous contribution (`old`), and whether this member was deleted. The helpers encode that, so a group stays correct without recomputing every member.

| Accumulator | State | Use it for |
|---|---|---|
| `$sum(expr)` | `number` | totals such as `_lifetimeSpend`; deletions and edits subtract the old value |
| `$countDict(expr)` | `Record<string, number>` | how many times each string appears; zero counts disappear |
| `$countDictArray(expr)` | `Record<string, number>` | the same, when the input is an array of strings |
| `$pushDict(key, value)` | map of values | collect values under a key, with add and remove |
| `$accumulator(init, args, accumulate, merge)` | whatever `init` returns | a fold you write in JavaScript |

`$keys(map)` and `$entries(map)` are expressions over that stored state. They belong in the `extra` argument of `$group` / `$groupId`, where the document is the group result. `$keys` turns a `_tagCounts` map into the `_tags` array readers actually query.

`$accumulator` takes plain functions. They are shipped to MongoDB as JavaScript (`lang: 'js'`), so keep them self-contained: no closures over outside variables. `accumulate` receives the state plus the values you listed in the argument array. `merge` combines two states. The delta wiring (old value, deleted flag) is up to the argument expressions you pass. `$countDict` in `lib/accumulators/index.ts` is the pattern: it reads `root<Part<Doc>>().of('v' | 'old' | 'deleted')`.

## Predicates and queries

Two layers, used in different places:

**Expressions** (`eq`, `and`, `notNull`, `$match`) run inside the pipeline, on the document flowing through.

**Query predicates** (`$eq`, `$ne`, `$gt`, `$in`, `$exists`, `$type`, and `field.has(...)`) build a MongoDB filter. They show up in `hardMatch`, and internally in the resume filters `msync` writes for you.

```ts
import { $and, $eq } from '@omegup/msync'

hardMatch: $and(
  root<Order>().of('status').has($eq('open')),
)
```

`$and`, `$or`, and `$nor` combine queries and skip any argument that is null, which is why a filter can be `condition && query`.

## Machine

```ts
const machine = new Machine()
machine.add(runner)          // the value returned by .out(...)
machine.add(other.runner())  // a nested Machine exposes .runner() too

await machine.start(info => {
  // info.debug  — "<stream> on <collection>: <step>"
  // info.job    — the job object for this tick
  // return true to stop
})
```

One runner: the machine is that runner. Several runners: they are merged, and the first one that has work proceeds. `.start` loops until the callback returns `true` or a tick throws. A thrown error is logged and the process exits.

`wrap(machine)` is the identity. It exists so a function can accept a machine and return one.

`info.debug` names the stream, the collection, and the step: catching up, cloning into the snapshot, running the aggregation, waiting for a change. Log it from the `start` callback.

## What gets stored

For a `staging` stream named `order-account-name` on `orders`:

| Collection | Role |
|---|---|
| `orders_order-account-name_snapshot` | Last committed `before`, in-flight `after`, `updated` flag |
| `__last` | One document per stream name: resume time, the pipeline payload, and whether a job is in progress |

`from` uses only `__last`.

On startup the stream compares the pipeline payload it is about to run with the payload stored in `__last`. The same payload resumes from the saved timestamp. A different payload runs teardown first:

- `$merge` unsets the fields it owns
- `$group` / `$groupId` unsets accumulator and extra fields
- `$insert` soft-deletes the rows it owns, matched by the constant extension fields when you used `$insertPart`

Then it rebuilds. Dropping a snapshot by hand forces a rebuild only if you also clear that stream's `__last` document; otherwise the next start trusts the saved timestamp.

Indexes `msync` ensures:

- `touchedAt` on the source, partial on `hardMatch` when you set one
- snapshot indexes on `updated`, `before`, and `after` so each tick can find the rows that just changed
- `before.<localField>` and `before.<foreignField>` when a `$lookup` is involved

Change-stream pre- and post-images are enabled on the source collection (`collMod`). The server-side expiry of those images is yours to set. `prepare()` sets `expireAfterSeconds: 60` at the cluster and connects with `MONGO_URL`. A stream that falls further behind than that window has to rebuild, because the pre-image it needs has expired.

## Names

`staging` and `from` record the call stack next to the stream name. The same name from a second call site throws `streamName already used`. One name, one definition, one `__last` document.

Include the role in the name (`'account-lifetime-spend'`, `'plans-for-entitlements'`). Inner lookups need their own names, because they are streams with their own snapshots.

## Composing areas

An area is a function from a client to a `Machine`. Billing owns orders and spend. Catalog owns plans and entitlements. The process does not care how many streams sit inside each one.

```ts
export function billing(client: MongoClient) {
  const db = client.db(process.env.MONGO_NAME)
  const machine = new Machine()
  const accounts = db.collection<Account & Model>('accounts')
  const orders = db.collection<Order & Model>('orders')

  machine.add(makeAccountCohortStream(accounts))
  machine.add(makeOrderAccountNameStream(orders, accounts))
  machine.add(makeAccountSpendStream(orders, accounts))
  return machine
}
```

```ts
const machine = new Machine()
machine.add(billing(client).runner())
machine.add(catalog(client).runner())
await machine.start(info => {
  console.log(new Date(), info.debug)
})
```

The order you `add` streams is a reading order. The `_` convention is the actual dependency. A stream that projects `_accountName` ignores orders until that field is there, whether or not it was registered after the stream that writes it.

## Conventions that keep types honest

- Intersect your document type with `Model` at the collection boundary: `Collection<Order & Model>`.
- Narrow the view with `OPick<Doc, '_id' | 'accountId'>` (or a projection `as const` and `keyof typeof projection`) and pass that key union as the second type argument of `staging<Doc, Keys>`. The rest of the pipeline then only offers those fields.
- Use `O<{ ... }>` for the object types you pass to `root<T>()` and to `$merge<O<{ ... }>>()`. `O` marks the type as a document the type-level machinery can pick apart.
- Use `Arr<T>` and `Rec<K, V>` from `@omegup/msync` in types that flow into expressions and accumulators. They are the aliases the signatures expect.
- Pair every derived field with a leading `_` unless you have a reason to list it in `needs`.
- Keep one stream responsible for a given derived field. Two streams writing `_accountName` will overwrite each other, and teardown of either one will unset it.
