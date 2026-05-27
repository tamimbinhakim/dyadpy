// Deprecated shim. `@dyadpy/svelte` has been renamed to `@causewayjs/svelte`.
// `createDyadpyStores` was renamed to `createCausewayStores`; `DyadpyStores`
// to `CausewayStores`. Old names re-exported as aliases.

export {
  createCausewayStores,
  createCausewayStores as createDyadpyStores,
} from "@causewayjs/svelte";

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
} from "@causewayjs/svelte";
