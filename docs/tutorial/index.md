# Tutorial

One small domain runs through every example. Accounts place orders. Plans are sold per region. Each function takes the collections it touches and returns a runner. The runners are what you hand to a `Machine`.

| Step | What it maintains | Entry |
|---|---|---|
| [A field on the same document](./cohort.md) | `_cohort` on the account, from `createdAt` | `from` |
| [Copy a field across a reference](./lookup.md) | `_accountName` on the order | `staging` and `$lookup` |
| [A total on the parent](./group.md) | `_lifetimeSpend` on the account | `$groupId` and `$sum` |
| [A collection of pairs](./entitlements.md) | one entitlement per account and plan in a region | `$lookup` with `to: 'many'`, then `$insert` |
| [Run them together](./run.md) | one `Machine` | |

If you have not installed the package or started a machine yet, begin with [Getting started](../getting-started.md).
