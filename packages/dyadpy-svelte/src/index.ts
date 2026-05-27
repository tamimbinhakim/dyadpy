// Deprecated shim. `@dyadpy/svelte` has been renamed to `causeway-svelte`.
// `createDyadpyStores` was renamed to `createCausewayStores`; `DyadpyStores`
// to `CausewayStores`. Old names re-exported as aliases.

export {
  createCausewayStores,
  createCausewayStores as createDyadpyStores,
} from "causeway-svelte";

export type {
  ArgsOf,
  CausewayStores,
  CausewayStores as DyadpyStores,
  DataOf,
  ErrorOf,
  MutationStoreValue,
  QueryStoreOptions,
  QueryStoreValue,
  StreamItemOf,
  StreamKeys,
  SubscriptionStoreValue,
  UnaryKeys,
} from "causeway-svelte";
