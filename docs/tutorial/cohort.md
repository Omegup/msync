# A field on the same document

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

`root<T>()` is the current document, typed as `T`. `.of('key')` steps into a field. `.expr()` turns the path into a value you can pass to `monthPart`, `$sum`, `$merge`, and the rest.

Next: [copy the account name onto each order](./lookup.md).
