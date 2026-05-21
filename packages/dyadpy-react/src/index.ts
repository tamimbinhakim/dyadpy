export {
  createReactClient,
  type ReactClient,
  type UseDyadpySubscriptionOptions,
  type UseDyadpySubscriptionResult,
} from "./hooks.js";

export {
  buildNamespaceTree,
  computeNamespace,
  type NamespaceEntry,
  type ProxyRouteDescriptor,
  type TreeNode,
} from "./proxy.js";

export type { SubscriptionStatus } from "./types.js";
