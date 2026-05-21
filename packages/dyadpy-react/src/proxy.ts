// tRPC-style nested client. Wraps a flat `ReactClient<TApi>` and the route
// descriptors emitted by the generated client, exposing operations under a
// nested namespace derived from each route's URL path.
//
//   api.customers.list.useQuery()
//   api.customers.byId.useQuery({ id })
//   api.customers.create.useMutation()
//   api.customers.holds.list.useQuery({ id })
//   api.customers.holds.release.useMutation()
//
// Mapping rules (URL path + HTTP method → namespace path + verb):
//   • Literal path segments form the namespace prefix.
//   • Bracket-style params (``{id}``, ``$id``) are skipped from the namespace
//     because they don't disambiguate the resource at design time.
//   • The verb is derived from the method + trailing-literal segment:
//       GET  /x          → x.list
//       GET  /x/{id}     → x.byId
//       GET  /x/{id}/y   → x.y.list
//       POST /x          → x.create
//       POST /x/{id}     → x.update     (mostly via PATCH; POST collisions resolved)
//       POST /x/{id}/y   → x.y          (action verb on a sub-resource)
//       PATCH /x/{id}    → x.update
//       DELETE /x/{id}   → x.delete
//   • When the operation name supplied by the descriptor doesn't fit any of
//     the above heuristics (e.g. ``decideApproval``, ``releaseHold``), the
//     trailing function name is used verbatim as the verb.
//
// Types are intentionally permissive (mostly ``any``) until the codegen emits
// a nested operation map. The runtime contract is stable; only the type
// surface needs tightening in a follow-up.

import type { ReactClient } from "./hooks.js";
import type { UnaryKeys } from "./types.js";

export interface ProxyRouteDescriptor {
  method: string;
  path: string;
  name: string;
}

// Operation flavours exposed on each leaf of the proxy. Mirrors what a flat
// ``ReactClient`` exposes per-method, but with the method name and args
// pre-bound by the proxy.
export interface QueryLeaf {
  queryKey: (args?: unknown) => readonly unknown[];
  queryOptions: (args?: unknown, options?: unknown) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime hook
  useQuery: (args?: unknown, options?: unknown) => any;
  suspenseQueryOptions: (args?: unknown, options?: unknown) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime hook
  useSuspenseQuery: (args?: unknown, options?: unknown) => any;
}

export interface MutationLeaf {
  mutationOptions: (options?: unknown) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime hook
  useMutation: (options?: unknown) => any;
}

export type Leaf = QueryLeaf & MutationLeaf;

// One nested-namespace path, computed once at proxy construction.
interface NamespaceEntry {
  segments: readonly string[]; // ['customers', 'holds']
  verb: string; // 'list' | 'create' | 'byId' | 'release' | ...
  operationName: string; // flat key in the original API (e.g. 'releaseHold')
}

function isParamSegment(segment: string): boolean {
  if (segment.length < 3) return false;
  if (segment.startsWith("{") && segment.endsWith("}")) return true;
  if (segment.startsWith("$")) return true;
  if (segment.startsWith("[") && segment.endsWith("]")) return true;
  return false;
}

function methodVerb(method: string, endsWithParam: boolean): string | null {
  const m = method.toUpperCase();
  if (m === "GET") return endsWithParam ? "byId" : "list";
  if (m === "POST") return endsWithParam ? null : "create";
  if (m === "PATCH" || m === "PUT") return "update";
  if (m === "DELETE") return "delete";
  return null;
}

function splitCamel(s: string): string[] {
  // 'listCustomers' -> ['list','customers']; 'releaseHold' -> ['release','hold']
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// Heuristic: strip a resource-name suffix from the operation name when the
// trailing segment matches the deepest namespace segment.
// 'listCustomers' under ['customers'] -> 'list'
// 'releaseHold'   under ['customers','holds'] -> 'release'
function deriveVerb(
  operationName: string,
  namespaceTail: string | undefined,
  method: string,
  endsWithParam: boolean,
): string {
  const fallback = methodVerb(method, endsWithParam);
  if (!namespaceTail) {
    return fallback ?? operationName;
  }

  const parts = splitCamel(operationName);
  if (parts.length === 0) return fallback ?? operationName;

  // Try to strip the resource as a suffix (case-insensitive, allow plural→singular).
  const tail = namespaceTail.toLowerCase();
  const singular = tail.endsWith("s") ? tail.slice(0, -1) : tail;
  const last = parts[parts.length - 1] ?? "";
  if (last === tail || last === singular) {
    const stripped = parts.slice(0, -1).join("");
    if (stripped.length > 0) return lowerFirst(stripped);
    // No verb left after stripping (e.g. just 'customers') → fall back.
    return fallback ?? operationName;
  }

  // Single-token names that match the resource exactly (e.g. handler named
  // ``release`` on ``/holds/{id}``) read as the verb directly.
  if (parts.length === 1) return parts[0] ?? operationName;
  return fallback ?? operationName;
}

function computeNamespace(route: ProxyRouteDescriptor): NamespaceEntry {
  const segments = route.path.split("/").filter((seg) => seg.length > 0 && !isParamSegment(seg));
  const trailingParam = (() => {
    const parts = route.path.split("/").filter((s) => s.length > 0);
    const last = parts[parts.length - 1];
    return last !== undefined && isParamSegment(last);
  })();
  const namespaceTail = segments[segments.length - 1];

  // Method-derived verb takes the leaf name when possible; otherwise we strip
  // the resource suffix from the operation name.
  const heuristic = methodVerb(route.method, trailingParam);
  let verb: string =
    heuristic ?? deriveVerb(route.name, namespaceTail, route.method, trailingParam);
  // ``POST /x/{id}/y`` is an action verb on a sub-resource — prefer the
  // handler's last camel-cased token so ``approveKyc`` reads as ``.approveKyc``
  // instead of ``.create``.
  if (route.method.toUpperCase() === "POST" && segments.length > 1 && !trailingParam) {
    const handlerVerb = deriveVerb(route.name, namespaceTail, route.method, trailingParam);
    if (handlerVerb !== "create" && handlerVerb !== route.name) {
      verb = handlerVerb;
    }
  }

  return { segments, verb, operationName: route.name };
}

function camelCase(parts: readonly string[]): string {
  return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");
}

interface TreeNode {
  children: Map<string, TreeNode>;
  leaves: Map<string, NamespaceEntry>; // verb → entry
}

function buildTree(entries: readonly NamespaceEntry[]): TreeNode {
  const root: TreeNode = { children: new Map(), leaves: new Map() };
  for (const entry of entries) {
    let cursor = root;
    for (const seg of entry.segments) {
      let next = cursor.children.get(seg);
      if (next === undefined) {
        next = { children: new Map(), leaves: new Map() };
        cursor.children.set(seg, next);
      }
      cursor = next;
    }
    // Disambiguate collisions: same namespace, same verb -> append camelCased
    // operation suffix so both routes remain reachable.
    let key = entry.verb;
    if (cursor.leaves.has(key)) {
      const fallback = camelCase(splitCamel(entry.operationName));
      key = fallback;
    }
    cursor.leaves.set(key, entry);
  }
  return root;
}

function makeLeafProxy<TApi>(client: ReactClient<TApi>, entry: NamespaceEntry): Leaf {
  const name = entry.operationName as UnaryKeys<TApi>;
  const k = (a: unknown) => client.queryKey(name, a as never);
  const qo = (a: unknown, o: unknown) => client.queryOptions(name, a as never, o as never);
  const sqo = (a: unknown, o: unknown) => client.suspenseQueryOptions(name, a as never, o as never);
  const uq = (a: unknown, o: unknown) => client.useQuery(name, a as never, o as never);
  const usq = (a: unknown, o: unknown) => client.useSuspenseQuery(name, a as never, o as never);
  const mo = (o: unknown) => client.mutationOptions(name, o as never);
  const um = (o: unknown) => client.useMutation(name, o as never);
  return {
    queryKey: k as Leaf["queryKey"],
    queryOptions: qo as Leaf["queryOptions"],
    useQuery: uq as Leaf["useQuery"],
    suspenseQueryOptions: sqo as Leaf["suspenseQueryOptions"],
    useSuspenseQuery: usq as Leaf["useSuspenseQuery"],
    mutationOptions: mo as Leaf["mutationOptions"],
    useMutation: um as Leaf["useMutation"],
  };
}

function makeNodeProxy<TApi>(client: ReactClient<TApi>, node: TreeNode): unknown {
  const target = {};
  return new Proxy(target, {
    get(_t, prop: string) {
      const leaf = node.leaves.get(prop);
      if (leaf !== undefined) return makeLeafProxy(client, leaf);
      const child = node.children.get(prop);
      if (child !== undefined) return makeNodeProxy(client, child);
      return undefined;
    },
    ownKeys() {
      return [...node.children.keys(), ...node.leaves.keys()];
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  });
}

// Permissive default type — replace at usage-site by passing a properly
// typed ``api`` shape (see the codegen-emitted ``Operations`` nested map).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime proxy default
export type NestedClient = any;

export function createNestedClient<TApi>(
  client: ReactClient<TApi>,
  routes: readonly ProxyRouteDescriptor[],
): NestedClient {
  const entries = routes.map((r) => computeNamespace(r));
  const tree = buildTree(entries);
  return makeNodeProxy(client, tree);
}

// Exported so the codegen can re-use the same naming algorithm.
export { computeNamespace, deriveVerb, methodVerb };
