# Copy a field across a reference

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
        to: 'one',
        from: staging(
          {
            collection: accounts,
            projection: { name: ['name', 1] },
          },
          'accounts-for-orders',
        ).get(),
        localField: root<OrderView>().of('accountId'),
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

`$lookup` keeps documents that match. `$outerLookup` keeps the left document when the right side is missing, and types the joined field as `T | null`.

`to: 'one'` means `localField` points at the right document's `_id`, so there is no `foreignField`. Each left row matches one right row, and the result keeps the left `_id`. `to: 'many'` is several matches per left row, or a join on some other field. That case is the [entitlements](/tutorial/entitlements) stream.

Next: [keep a lifetime total on the account](/tutorial/group).
