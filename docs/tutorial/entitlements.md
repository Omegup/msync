# A collection of pairs

Plans are sold per region. Every account in a region is entitled to every plan in that region. Each pair is its own document in `entitlements`, with `_id` of `accountId-planId`, so other streams can aggregate entitlements directly. When the plan's price changes, the entitlement updates. When the account or the plan goes away, the entitlement is soft-deleted.

Several plans can share a region, so this lookup is `to: 'many'`. `middle: '-'` is required, and the lookup sets each row's `_id` to the account id, that hyphen, and the plan id. Copy `accountId` off `_id` before the join, because the composite id replaces it. `$replaceWith` keeps the id the lookup already assigned. `$insert` upserts by that `_id`, and on a deleted input it sets `deletedAt`.

```ts
import type { Collection, ID, Model, O, OPick } from '@omegup/msync'
import { $insert, $lookup, $replaceWith, $set, field, root, staging, to } from '@omegup/msync'

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
  type WithAccountId = AccountView & O<{ accountId: string }>
  type Joined = WithAccountId & { readonly plan: PlanView }

  return staging<Account & Model, keyof AccountView>(
    {
      collection: accounts,
      projection: { regionId: ['regionId', 1] },
    },
    'entitlements-from-accounts',
  )
    .then(
      $set<O<{ accountId: string }>>()({
        accountId: ['accountId', to(root<AccountView>().of('_id').expr())],
      }),
    )
    .with(
      $lookup({
        as: 'plan',
        to: 'many',
        middle: '-',
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
        localField: root<WithAccountId>().of('regionId'),
        foreignField: root<PlanView>().of('regionId'),
      }),
    )
    .then(
      $replaceWith(
        field<Entitlement, Joined>({
          _id: ['_id', root<Joined>().of('_id').expr()],
          accountId: ['accountId', root<Joined>().of('accountId').expr()],
          planId: ['planId', root<Joined>().of('plan').of('_id').expr()],
          price: ['price', root<Joined>().of('plan').of('price').expr()],
        }),
      ),
    )
    .get()
    .out($insert(entitlements))
}
```

The same account and the same plan always produce the same `_id`, because `middle` is part of the lookup. That is how the next run finds the row to update or retire.

Next: [run every stream on one machine](./run.md).
