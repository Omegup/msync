import type { Collection } from 'mongodb'
import { $merge } from '../lib/aggregate/$merge'
import { $replaceWith, $set } from '../lib/aggregate/set'
import { staging } from '../lib/boot'
import { $mergeObjects } from '../lib/expression/array'
import { concat, field, str } from '../lib/expression/concat'
import { exprMapVal } from '../lib/expression/logic'
import { $map, $map1 } from '../lib/expression/range'
import { val } from '../lib/expression/val'
import { root } from '../lib/field'
import { $lookup } from '../lib/stream/$lookup'
import type { Model, TS } from '../lib/types'
import { set, to } from '../lib/update'
import type { Arr, O, OPick, Rec, StrKey, WriteonlyCollection, doc, notArr } from '../types'
import { $groupMerge } from '../lib/aggregate/group'
import { $sum } from '../lib/accumulators'

type NotificationType = 'invoice' | 'payment'
type Notification = {
  readonly _id: string
  readonly userId: string
  readonly _data: notArr
  readonly data: notArr
  readonly type: NotificationType
  readonly deletedAt: Date | null
  readonly ready?: boolean | null
  readonly seen: boolean | null
}

export type UserBase = O<{ _id: string; lastName: string; firstName: string; email: string }>

export const fillDataNotification = (
  notifications: Collection<Notification & Model>,
  users: Collection<UserBase & Model>,
) => {
  type NOtif = OPick<Notification & Model, 'userId' | '_data' | '_id' | 'type'>
  type USer = OPick<UserBase & Model, 'firstName' | 'lastName' | '_id' | 'email'>
  type Joined = NOtif & Rec<'user', USer>
  type Data = Notification['_data']

  return staging<Notification & Model, StrKey<NOtif>>(
    {
      collection: notifications,
      projection: {
        userId: ['userId', 1],
        _data: ['_data', 1],
        type: ['type', 1],
      },
    },
    'notif-users',
  )
    .with<NOtif, Joined>(
      $lookup({
        from: staging<UserBase & Model, StrKey<USer>>(
          {
            collection: users,
            projection: {
              firstName: ['firstName', 1],
              email: ['email', 1],
              lastName: ['lastName', 1],
            },
          },
          'invoice-payment-notif',
        ).get(),
        as: 'user',
        foreignField: root<USer>().of('_id'),
        localField: root<NOtif>().of('userId'),
      }),
    )
    .then(
      $replaceWith<
        Joined,
        O<{ readonly data: Data; readonly ready: boolean; readonly _id: string }>
      >(
        field({
          _id: ['_id', root<Joined>().of('_id').expr()],
          data: [
            'data',
            $mergeObjects(
              root<Joined>().of('_data').expr(),
              field({
                name: [
                  'name',
                  concat(
                    root<Joined>().of('user').of('firstName').expr(),
                    val(' '),
                    root<Joined>().of('user').of('lastName').expr(),
                  ),
                ],
                email: ['email', root<Joined>().of('user').of('email').expr()],
                url: [
                  'url',
                  concat(
                    val('baseurl'),
                    exprMapVal<
                      NotificationType,
                      { readonly [k in NotificationType]: string },
                      Joined,
                      unknown
                    >(
                      root<Joined>().of('type').expr(),
                      { invoice: val('invoice_url'), payment: val('payment_url') },
                      val(''),
                    ),
                  ),
                ],
              }),
            ),
          ],
          ready: ['ready', val(true)],
        }),
      ),
    )
    .get()
    .out(
      $merge<Notification & Model>()(notifications, {
        data: ['data', 1],
        ready: ['ready', 1],
      }),
    )
}

export const fillDataNotification2 = (
  notifications: Collection<Notification & Model>,
  users: Collection<UserBase & Model>,
) => {
  type NOtif = OPick<Notification & Model, 'userId' | '_data' | '_id' | 'type'>
  type USer = OPick<UserBase & Model, 'firstName' | 'lastName' | '_id' | 'email'>
  type Joined = NOtif & Rec<'user', USer>
  type Data = Notification['_data']

  return staging<Notification & Model, StrKey<NOtif>>(
    {
      collection: notifications,
      projection: {
        userId: ['userId', 1],
        _data: ['_data', 1],
        type: ['type', 1],
      },
    },
    'notif-users',
  )
    .with<NOtif, Joined>(
      $lookup({
        from: staging<UserBase & Model, StrKey<USer>>(
          {
            collection: users,
            projection: {
              firstName: ['firstName', 1],
              email: ['email', 1],
              lastName: ['lastName', 1],
            },
          },
          'invoice-payment-notif',
        ).get(),
        as: 'user',
        foreignField: root<USer>().of('_id'),
        localField: root<NOtif>().of('userId'),
      }),
    )
    .then(
      $set<O<{ readonly data: Data; readonly ready: boolean; readonly _id: string }>>()({
        data: [
          'data',
          to(
            $mergeObjects(
              root<Joined>().of('_data').expr(),
              field({
                name: [
                  'name',
                  concat(
                    root<Joined>().of('user').of('firstName').expr(),
                    val(' '),
                    root<Joined>().of('user').of('lastName').expr(),
                  ),
                ],
                email: ['email', root<Joined>().of('user').of('email').expr()],
                url: [
                  'url',
                  concat(
                    val('baseurl'),
                    exprMapVal<
                      NotificationType,
                      { readonly [k in NotificationType]: string },
                      Joined,
                      unknown
                    >(
                      root<Joined>().of('type').expr(),
                      { invoice: val('invoice_url'), payment: val('payment_url') },
                      val(''),
                    ),
                  ),
                ],
              }),
            ),
          ),
        ],
        ready: ['ready', to(val(true))],
      }),
    )
    .get()
    .out(
      $merge<Notification & Model>()(notifications, {
        data: ['data', 1],
        ready: ['ready', 1],
      }),
    )
}

type WithRange = doc & Rec<'item', Arr<number>>

$set<Rec<'item', Arr<doc>>>()({
  item: [
    'item',
    to($map(root<WithRange>().of('item').expr(), item => field({ _id: ['_id', str(item)] }))),
  ],
})

type T = doc & Rec<'item', Arr<Rec<'x', number>>>

$set<Rec<'item', Arr<Rec<'x', Arr<string>>>>>()({
  item: [
    'item',
    set<Rec<'x', Arr<string>>>()({
      x: ['x', to($map1(root<T>().of('item').expr(), item => str(item.of('x').expr())))],
    }),
  ],
})

type Source = O<{ x: number; id: string }>
const collection: WriteonlyCollection<TS & doc & { x: number }> = null!
$groupMerge<Source, string, O<{ x: number }>, '_id'>(
  root<Source>().of('id').expr(),
  {
    x: ['x', $sum(root<Source>().of('x').expr())],
  },
  collection,
  '_id',
  (ts, gid) => ({ ...ts, _id: ['_id', gid('_id')] }),
)
