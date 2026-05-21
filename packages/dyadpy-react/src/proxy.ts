/**
 * Namespace-tree builder for the React client.
 *
 * Naming is generated once by `dyadpy/codegen.py` and carried in each route
 * descriptor as `segments` + `verb`. The React package deliberately does not
 * recompute names from HTTP method/path; one generated namespace is the API.
 */

export interface ProxyRouteDescriptor {
  method: string;
  path: string;
  name: string;
  segments: readonly string[];
  verb: string;
  params?: readonly unknown[];
}

export interface NamespaceEntry {
  /** Literal generated namespace segments. */
  segments: readonly string[];
  /** Generated leaf verb (`list` / `byId` / `create` / `release` / ...). */
  verb: string;
  /** Stable operation key used for query keys. */
  operationName: string;
  /** Whether the generated API method expects an args object before options. */
  hasArgs: boolean;
}

export interface TreeNode {
  children: Map<string, TreeNode>;
  /** verb -> entry */
  leaves: Map<string, NamespaceEntry>;
}

export function computeNamespace(route: ProxyRouteDescriptor): NamespaceEntry {
  return {
    segments: route.segments,
    verb: route.verb,
    operationName: route.name,
    hasArgs: (route.params?.length ?? 0) > 0,
  };
}

export function buildNamespaceTree(routes: readonly ProxyRouteDescriptor[]): TreeNode {
  const root: TreeNode = { children: new Map(), leaves: new Map() };
  for (const route of routes) {
    const entry = computeNamespace(route);
    let cursor = root;
    for (const seg of entry.segments) {
      let next = cursor.children.get(seg);
      if (next === undefined) {
        next = { children: new Map(), leaves: new Map() };
        cursor.children.set(seg, next);
      }
      cursor = next;
    }
    if (cursor.leaves.has(entry.verb)) {
      throw new Error(
        `Dyadpy React: duplicate generated namespace leaf ${[...entry.segments, entry.verb].join(
          ".",
        )}`,
      );
    }
    cursor.leaves.set(entry.verb, entry);
  }
  return root;
}
