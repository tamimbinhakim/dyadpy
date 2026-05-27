// Deprecated shim. `@dyadpy/react` has been renamed to `causeway-react`.
// Original symbols are re-exported plus the `Dyadpy*` aliases for the
// renamed `UseCausewaySubscription*` types.

export {
  buildNamespaceTree,
  computeNamespace,
  createReactClient,
} from "causeway-react";

export type {
  NamespaceEntry,
  ReactClient,
  ReactRouteMeta,
  SubscriptionStatus,
  TreeNode,
  UseCausewaySubscriptionOptions,
  UseCausewaySubscriptionResult,
  UseCausewaySubscriptionOptions as UseDyadpySubscriptionOptions,
  UseCausewaySubscriptionResult as UseDyadpySubscriptionResult,
} from "causeway-react";
