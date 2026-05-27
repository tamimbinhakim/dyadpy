// Deprecated shim. `@dyadpy/solid` has been renamed to `@causewayjs/solid`.
// `createDyadpyResources` was renamed to `createCausewayResources`;
// `DyadpyResources` to `CausewayResources`. Old names re-exported as aliases.

export {
  createCausewayResources,
  createCausewayResources as createDyadpyResources,
} from "@causewayjs/solid";

export type {
  ArgsOf,
  CausewayResources,
  CausewayResources as DyadpyResources,
  DataOf,
  ErrorOf,
  MutationResource,
  QueryResource,
  StreamItemOf,
  StreamKeys,
  SubscriptionResource,
  UnaryKeys,
} from "@causewayjs/solid";
