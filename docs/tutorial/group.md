# A total on the parent

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

When the thing you are counting is a set of strings rather than a number, use `$countDict`. The [guide](../guide.md#accumulators) shows it next to `$sum`.

Next: [materialize one document per account and plan](./entitlements.md).
