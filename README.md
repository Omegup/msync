# @omegup/msync

`msync` keeps derived MongoDB data in sync with the documents it comes from.

You describe the derivation the way you would write an aggregation: project the fields you read, join, reshape, group, and write the result back. `msync` runs that description once over the existing data, then again on every change. Joins, sums, and counts update from the delta. A deleted source drops out of the result. A changed source rewrites only the documents that depend on it.

The school sync in `back-sync` is built this way: dozens of streams turn raw collections (users, groups, marks, invoices) into the fields and collections the app actually reads, and a single `Machine` keeps all of them running.

## Install

```bash
bun add @omegup/msync
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

6. **Streams compose by reading each other's fields.** A field whose name starts with `_` is treated as derived. A later stream that projects `_rowName` waits until that field exists, so you can add every stream to one machine and they still line up.

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
type User = {
  _id: string
  birthdate: Date
  _dayOfBirth?: string | null   // written by a stream
  _yearOfBirth?: number | null
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
  birthdate: ['birthdate', 1],
  classId: ['classId', 1],
}
```

A field expression is a pair too, `[fieldName, expr]`, inside `field({ ... })` and inside merge and group maps.

```ts
root<User>().of('birthdate').expr()   // this document's field
val(' - ')                             // a literal
concat(row, val(' - '), column)        // an expression
```

`root<T>()` is the current document, typed as `T`. `.of('key')` steps into a field. `.expr()` turns the path into a value you can pass to `concat`, `$sum`, `$merge`, and the rest.

## Tutorial

Each example is a function from collections to a runner. The runners are what you hand to a `Machine`. They are the same shapes used throughout `back-sync`.

### 1. Patch the document you just read

A user has a `birthdate`. Keep `_dayOfBirth` (`MM-DD`) and `_yearOfBirth` on that same user, and refresh them whenever `birthdate` changes.

`from` is enough: there is no join and no previous value to subtract.

```ts
import type { Collection, Model, N, O } from '@omegup/msync'
import { $simpleMerge, dayAndMonthPart, from, root, year } from '@omegup/msync'

type User = O<{
  _id: string
  birthdate: Date
  _dayOfBirth: string | N
  _yearOfBirth: number | N
}>

export const makeUserBirthdayStream = (users: Collection<User & Model>) =>
  from(
    {
      collection: users,
      projection: { birthdate: ['birthdate', 1] },
    },
    'users-birthday',
  )
    .get()
    .out(
      $simpleMerge<O<{ _dayOfBirth: string; _yearOfBirth: number }>>()(users, {
        _dayOfBirth: ['_dayOfBirth', dayAndMonthPart(root<User>().of('birthdate').expr())],
        _yearOfBirth: ['_yearOfBirth', year(root<User>().of('birthdate').expr())],
      }),
    )
```

`$simpleMerge` writes those keys onto the same `_id`. The document is already there, so a missing target fails the merge. On the next change of `birthdate`, only that user is rewritten.

### 2. Copy a field across a join

An evaluation cell points at a row through `rowId`. The row has `_name`. Write that name onto the cell as `_rowName`.

This needs `staging`, because `$lookup` is incremental: it has to notice when the row's name changes, and when the cell's `rowId` changes, and update the cell either way.

```ts
import type { Collection, Model, O, OPick, StrKey } from '@omegup/msync'
import { $lookup, $merge, root, staging } from '@omegup/msync'

type Cell = O<{ _id: string; rowId: string; _rowName?: string }>
type Row = O<{ _id: string; _name: string }>

type CellView = OPick<Cell & Model, '_id' | 'rowId'>
type RowView = OPick<Row & Model, '_id' | '_name'>
type Joined = CellView & { readonly row: RowView }

export const makeEvalCellRowNameStream = (
  evalCells: Collection<Cell & Model>,
  termRows: Collection<Row & Model>,
) =>
  staging<Cell & Model, StrKey<CellView>>(
    {
      collection: evalCells,
      projection: { rowId: ['rowId', 1] },
    },
    'evalCells-rowName',
  )
    .with(
      $lookup({
        as: 'row',
        from: staging(
          {
            collection: termRows,
            projection: { _name: ['_name', 1] },
          },
          'termRows-evalCells',
        ).get(),
        localField: root<CellView>().of('rowId'),
        foreignField: root<RowView>().of('_id'),
      }),
    )
    .get()
    .out(
      $merge<O<{ _rowName: string }>>()(evalCells, {
        _rowName: ['_rowName', root<Joined>().of('row').of('_name').expr()],
      }),
    )
```

The inner `staging(...).get()` is a stream of its own. `$lookup` watches both sides. `$merge` patches `_rowName` back onto the cell. A later stream that projects `_rowName` will wait until this one has written it.

`$lookup` keeps documents that match. `$outerLookup` keeps the left document when the right side is missing, and types the joined field as `T | null`. The joined array is unwound, one row per match. `toMany: true` gives each of those rows its own id, built from both sides. Leave it off when the foreign field is `_id` and a later `$groupId` folds every match back onto the left document.

### 3. Reshape, then fold the list back onto the source

An assessment holds `evalCellIds`. Each cell has a row name and a column name. The assessment should store the distinct `"row - column"` labels in `_evaluableNames`.

The pipeline does three things:

- read assessments that have `evalCellIds`
- join those ids to cells, one row per matching cell, still carrying the assessment `_id`
- replace each row with `{ _id, _evaluableNames }`, then group the rows by that `_id`

`$groupId` folds into a document that already exists. The group key is that document's `_id`. The accumulator (`$countDict`) is delta-aware: adding a label increments its count, removing one decrements it, and a count of zero drops the key. `$keys` turns the surviving map into the array the app reads.

```ts
import type { Arr, Collection, Model, O, Rec, RORec } from '@omegup/msync'
import {
  $countDict,
  $groupId,
  $keys,
  $lookup,
  $replaceWith,
  concat,
  field,
  notNull,
  root,
  staging,
  val,
} from '@omegup/msync'

type EvalCell = O<{ _id: string; _columnName: string; _rowName: string }>
type Assessment = O<{ _id: string; evalCellIds: Arr<string> }>
type WithName = O<{ _id: string; _evaluableNames: string }>

export const makeAssessmentEvaluableNamesStream = (
  assessments: Collection<Assessment & Model>,
  evalCells: Collection<EvalCell & Model>,
) => {
  type Joined = Assessment & RORec<'evalCell', EvalCell>

  const evalCellsStage = staging(
    {
      collection: evalCells,
      projection: {
        _columnName: ['_columnName', 1],
        _rowName: ['_rowName', 1],
      },
    },
    'assessment-evaluable-names-evalCells',
  ).get()

  return staging<Assessment & Model, '_id' | 'evalCellIds'>(
    {
      collection: assessments,
      projection: { evalCellIds: ['evalCellIds', 1] },
      match: notNull(root<Assessment>().of('evalCellIds').expr()),
    },
    'assessment-evaluable-names',
  )
    .with(
      $lookup({
        as: 'evalCell',
        from: evalCellsStage,
        localField: root<Assessment>().of('evalCellIds'),
        foreignField: root<EvalCell>().of('_id'),
      }),
    )
    .then(
      $replaceWith(
        field({
          _id: ['_id', root<Joined>().of('_id').expr()],
          _evaluableNames: [
            '_evaluableNames',
            concat(
              root<Joined>().of('evalCell').of('_rowName').expr(),
              val(' - '),
              root<Joined>().of('evalCell').of('_columnName').expr(),
            ),
          ],
        }),
      ),
    )
    .get()
    .out(
      $groupId<
        WithName,
        O<{ readonly _evaluableNamesMap: Rec<string, number> }>,
        { _evaluableNames: Arr<string> },
        Model & Assessment
      >(
        root<WithName>().of('_id').expr(),
        {
          _evaluableNamesMap: [
            '_evaluableNamesMap',
            $countDict(root<WithName>().of('_evaluableNames').expr()),
          ],
        },
        assessments,
        {
          _evaluableNames: [
            '_evaluableNames',
            $keys(
              root<O<{ _evaluableNamesMap: Rec<string, number> }>>()
                .of('_evaluableNamesMap')
                .expr(),
            ),
          ],
        },
      ),
    )
}
```

Read `$groupId` as four arguments:

1. The group key, a string expression. For `$groupId` it must equal `_id` on the target.
2. Accumulators. Each value is `['field', accumulator]`. These fields are maintained incrementally on the target.
3. The target collection.
4. Extra fields, computed from the accumulator output on every update. `$keys` here is a plain expression over the grouped document, so it sees `_evaluableNamesMap` after the fold.

`$group` is the same fold when the target document does not exist yet. It stores the key in `_grp` and inserts a new document. Use it to build a summary collection. Use `$groupId` to hang a summary on a document you already have.

### 4. Create documents in another collection

A student evaluation system pairs with every grid of that system. Each pair is its own document in `studentEvalGrids`, with an `_id` of `studentId-gridId`. When the system or the grid goes away, the pair is soft-deleted.

`$replaceWith` builds the new document. `$insert` upserts it by `_id`, and on a deleted input it sets `deletedAt` on that `_id`.

```ts
import type { Collection, ID, Model, O, OPick } from '@omegup/msync'
import {
  $insert,
  $lookup,
  $replaceWith,
  concat,
  field,
  root,
  staging,
  val,
} from '@omegup/msync'

type System = O<{ _id: string; studentId: string; evaluationSystemId: string }>
type Grid = O<{ _id: string; evaluationSystemId: string; coef: number; order: number }>
type StudentGrid = O<{
  _id: string
  studentId: string
  evaluationGridId: string
  studentSystemId: string
  coef: number
  _order: number
}>

export const makeEvalGridStudentsStream = (
  systems: Collection<System & Model>,
  grids: Collection<Grid & Model>,
  studentGrids: Collection<StudentGrid & Model>,
) => {
  type SystemView = OPick<System & Model, keyof ID | 'studentId' | 'evaluationSystemId'>
  type GridView = OPick<Grid & Model, keyof ID | 'evaluationSystemId' | 'coef' | 'order'>
  type Joined = SystemView & { readonly evalGrid: GridView }

  return staging<System & Model, keyof SystemView>(
    {
      collection: systems,
      projection: {
        studentId: ['studentId', 1],
        evaluationSystemId: ['evaluationSystemId', 1],
      },
    },
    'evalGrid-students-create',
  )
    .with(
      $lookup({
        as: 'evalGrid',
        from: staging(
          {
            collection: grids,
            projection: {
              coef: ['coef', 1],
              order: ['order', 1],
              evaluationSystemId: ['evaluationSystemId', 1],
            },
          },
          'evalGrid-studentsSystems',
        ).get(),
        localField: root<SystemView>().of('evaluationSystemId'),
        foreignField: root<GridView>().of('evaluationSystemId'),
      }),
    )
    .then(
      $replaceWith(
        field<StudentGrid, Joined>({
          _id: [
            '_id',
            concat(
              root<Joined>().of('studentId').expr(),
              val('-'),
              root<Joined>().of('evalGrid').of('_id').expr(),
            ),
          ],
          studentId: ['studentId', root<Joined>().of('studentId').expr()],
          evaluationGridId: ['evaluationGridId', root<Joined>().of('evalGrid').of('_id').expr()],
          studentSystemId: ['studentSystemId', root<Joined>().of('_id').expr()],
          coef: ['coef', root<Joined>().of('evalGrid').of('coef').expr()],
          _order: ['_order', root<Joined>().of('evalGrid').of('order').expr()],
        }),
      ),
    )
    .get()
    .out($insert(studentGrids))
}
```

Give inserted documents a deterministic `_id`. That id is how the next run finds the same row to update or retire.

## Run them together

A `Machine` merges runners and loops forever. Each tick logs which stream did the work.

```ts
import { Machine, prepare } from '@omegup/msync'

const client = await prepare() // or your own MongoClient.connect()
const db = client.db(process.env.MONGO_NAME)

const machine = new Machine()
machine.add(makeUserBirthdayStream(db.collection('users')))
machine.add(makeEvalCellRowNameStream(db.collection('evaluationCells'), db.collection('termEvaluationRows')))
machine.add(makeAssessmentEvaluableNamesStream(db.collection('assessments'), db.collection('evaluationCells')))
machine.add(makeEvalGridStudentsStream(
  db.collection('studentEvaluationSystems'),
  db.collection('evaluationGrids'),
  db.collection('studentEvalGrids'),
))

await machine.start(info => {
  console.log(new Date(), info.debug)
})
```

`.start` resolves only when it stops. Return `true` from the callback to stop after the current tick. Add streams in an order you can read — producers of `_` fields before the streams that project them — then let the machine run them side by side. The `_` prefix (and `needs`) is what makes a consumer skip a document until the producer has filled it.

Stream names are unique inside the process. Reusing a name from two different call sites throws. Pick a name that says what the stream maintains: `'evalCells-rowName'`, `'users-birthday'`.

## Where this is used

`back-sync` splits the app into one machine per area (`evaluation`, `groups`, `invoice`, `attendance`, …) and adds each area's runners to a root `Machine`. Inside an area, the file comments mark phases: create the student grid, then the term rows that hang off it, then the cells, then the aggregates that read those cells. Each phase is a stream like the four above. The root process is the whole derived database, kept live.

## Next

[docs/guide.md](docs/guide.md) is the rest of the language: expressions, predicates, accumulators, the write modes side by side, and what the process stores while it runs.
