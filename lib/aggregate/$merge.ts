import type { ConstHKT, HKT, I, IdHKT, OPick, RWCollection } from '../../types'
import type { ID, N, O, RORec, Rec, Replace, StrKey, doc } from '../../types/json'
import { field, type ExprHKT, type ExprsExact, type ExprsExactHKT } from '../expression/concat'
import { eqTyped, ite } from '../expression/logic'
import { current, nil } from '../expression/val'
import { Field, root } from '../field'
import type { Delta, Expr, RawStages, StreamRunnerParam, TS } from '../types'
import { omitPick, omitRORec, type Equal } from '../utils/guard'
import { id } from '../utils/json'
import {
  mapExact,
  mapExactToObject,
  spread,
  type ExactKeys,
  type WithKey1,
} from '../utils/map-object'
import { $replaceWith_ } from './mongo-stages'
import { $merge_ } from './out'
import { link } from './prefix'

type OutInputE<T, E, A = T | null> = ID & Rec<'after', A> & E
type Allowed<K extends string> = Exclude<K, keyof (TS & ID)>

type Patch<V, KK extends StrKey<V>> = ((OPick<V, Allowed<KK>> & ID) | (Rec<Allowed<KK>, N> & ID)) &
  TS

const $mergeX = <
  V extends O,
  KK extends StrKey<V>,
  Out extends doc,
  D extends O,
  D2 extends O = D,
>(
  out: RWCollection<Out | Replace<Out, Patch<V, KK>>, Out>,
  keys: ExactKeys<Allowed<KK>>,
  f: Field<D2, TakeDoc<V, KK>>,
  map: (x: Expr<Patch<V, KK>, D2>) => Expr<Patch<V, KK>, D>,
): StreamRunnerParam<D, 'out'> => ({
  raw: (first: boolean): RawStages<unknown, D, 'out'> => {
    type K = Allowed<KK>
    type T = OPick<V, K> & ID
    type Patch = (T | (Rec<K, N> & ID)) & TS

    interface ExprHKT2<T, D, C = unknown> extends HKT<StrKey<T>> {
      readonly out: Expr<T[I<StrKey<T>, this>], D, C>
    }
    const patch: ExprsExact<OPick<V, K>, D2> = mapExactToObject<
      RORec<K, 1>,
      IdHKT,
      WithKey1<K, ExprHKT2<T, D2>>
    >(keys, (_, k) => [k, f.of<T, typeof k, 1>(k).expr()])

    const or: Expr<Patch, D2> = field<T & TS, D2>(
      omitPick<KK, never, keyof (TS & ID), V>().backward<ExprsExactHKT<TS & doc, D2>>(
        spread<Pick<V, K>, ID & TS, ExprHKT<D2>, O>(patch, {
          _id: ['_id', f.of('_id').expr()],
          touchedAt: ['touchedAt', current],
        }),
      ),
    )

    const replacer: Expr<Patch, D> = map(or)

    return link<D>()
      .with<unknown, Patch>($replaceWith_<D, Patch>(replacer))
      .with<unknown, 'out'>(
        $merge_<Patch, Out>({
          into: out,
          on: root<O<ID>>().of('_id'),
          whenNotMatched: 'fail',
          whenMatched: 'merge',
        }),
      ).stages
  },
  teardown: c =>
    c({
      collection: out,
      method: 'updateMany',
      params: [
        {},
        [
          {
            $unset: Object.keys(
              mapExactToObject<RORec<Allowed<KK>, 1>, IdHKT, ConstHKT<1>>(keys, () => 1),
            ),
          },
        ],
      ],
    }),
})

type TakeDoc<V, KK extends StrKey<V>> = OPick<V, Allowed<KK>> & ID

const $mergeId =
  <V extends O>() =>
  <KK extends StrKey<V>, Out extends doc, E = unknown>(
    out: RWCollection<Out | Replace<Out, Patch<V, KK>>, Out>,
    keys: ExactKeys<Allowed<KK>>,
    id: Expr<string, OutInputE<TakeDoc<V, KK>, E, null>>,
  ): StreamRunnerParam<OutInputE<OPick<V, Allowed<KK>> & ID, E>, 'out'> => {
    type OutInput<T, A = T | null> = OutInputE<T, E, A>
    interface AfterHKT<T> extends HKT {
      readonly out: OutInput<T> & RORec<'after', I<unknown, this>>
    }
    type K = Allowed<KK>
    type T = TakeDoc<V, KK>
    type Patch = (T | (Rec<K, N> & ID)) & TS

    type D = OutInputE<0, E, TakeDoc<V, KK> | null>
    type D2 = OutInputE<0, E, TakeDoc<V, KK>>

    const omRORec: Equal<unknown, RORec<K, N>, Omit<RORec<K, N>, keyof (TS & ID)>> = omitRORec<
      KK,
      never,
      keyof (TS & ID),
      N
    >()

    // Expr<Patch, ID & Obj & RORec<"after", T | null> & E & RORec<"after", Obj & Pick<V, Exclude<KK, "touchedAt" | "_id">> & ID>, unknown>

    return $mergeX<V, KK, Out, D, D2>(out, keys, root<D2>().of('after'), or => {
      return ite<Patch, null, T, AfterHKT<T>>(
        eqTyped<null, T, AfterHKT<T>>(root<OutInput<T>>().of('after').expr(), nil),
        field<RORec<K, N> & ID & TS, OutInput<T, null>>(
          omRORec.backward<ExprsExactHKT<ID & TS, OutInput<T, null>>>(
            spread<RORec<K, N>, ID & TS, ExprHKT<OutInput<T, null>>>(
              mapExact<RORec<K, 1>, IdHKT, ConstHKT<Expr<null, unknown>>>(keys, () => nil),
              {
                _id: ['_id', id],
                touchedAt: ['touchedAt', current],
              },
            ),
          ),
        ),
        or,
      )
    })
  }

export const $simpleMerge =
  <V extends O>() =>
  <KK extends StrKey<V>, Out extends doc, E = unknown>(
    out: RWCollection<Out | Replace<Out, Patch<V, KK>>, Out>,
    keys: ExactKeys<Allowed<KK>>,
  ): StreamRunnerParam<OPick<V, Allowed<KK>> & ID & E, 'out'> =>
    $mergeX<V, KK, Out, OPick<V, Allowed<KK>> & ID & E>(out, keys, root(), id)

export const $merge =
  <V extends O>() =>
  <KK extends StrKey<V>, Out extends doc>(
    out: RWCollection<Out | Replace<Out, Patch<V, KK>>, Out>,
    keys: ExactKeys<Allowed<KK>>,
  ): StreamRunnerParam<Delta<OPick<V, Allowed<KK>> & ID>, 'out'> =>
    $mergeId<V>()(
      out,
      keys,
      assertNotNull(
        root<
          OutInputE<
            OPick<V, Allowed<KK>> & ID,
            RORec<'before', (OPick<V, Allowed<KK>> & ID) | null>
          >
        >()
          .of('before')
          .of('_id')
          .expr(),
      ),
    )

const assertNotNull = <T, D, C>(expr: Expr<T | N, D, C>) => expr as Expr<T, D, C>
