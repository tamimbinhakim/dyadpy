/**
 * Namespace-tree builder for the tRPC-style React client. Given the route
 * descriptors emitted by the generated client, computes a nested namespace
 * (e.g. ``customers.holds.release``) for each operation. Pure data — no React
 * dependency.
 *
 * Naming rules (URL path + HTTP method → namespace path + verb):
 *   • Literal path segments form the namespace prefix.
 *   • Bracket-style params (``{id}``, ``$id``, ``[id]``) are skipped from the
 *     namespace because they don't disambiguate the resource at design time.
 *   • The verb is derived from the method + trailing-literal segment:
 *       GET  /x          → x.list
 *       GET  /x/{id}     → x.byId
 *       GET  /x/{id}/y   → x.y.list
 *       POST /x          → x.create
 *       POST /x/{id}/y   → x.y.<handler-verb>   (e.g. .release / .approve)
 *       PATCH /x/{id}    → x.update
 *       PUT   /x/{id}    → x.update
 *       DELETE /x/{id}   → x.delete
 *   • When method + trailing-param can't pick a verb (e.g. action POSTs that
 *     terminate in a param), the handler function name is used with the
 *     deepest namespace segment stripped (``releaseHold`` under
 *     ``customers.holds`` → ``release``).
 */

export interface ProxyRouteDescriptor {
  method: string;
  path: string;
  name: string;
}

export interface NamespaceEntry {
  /** Literal segments of the URL path. */
  segments: readonly string[];
  /** Leaf verb (``list`` / ``byId`` / ``create`` / ``release`` / …). */
  verb: string;
  /** Original flat operation key as emitted by codegen. */
  operationName: string;
}

export interface TreeNode {
  children: Map<string, TreeNode>;
  /** verb → entry */
  leaves: Map<string, NamespaceEntry>;
}

function isParamSegment(segment: string): boolean {
  if (segment.length < 3) return false;
  if (segment.startsWith("{") && segment.endsWith("}")) return true;
  if (segment.startsWith("$")) return true;
  if (segment.startsWith("[") && segment.endsWith("]")) return true;
  return false;
}

export function methodVerb(method: string, endsWithParam: boolean): string | null {
  const m = method.toUpperCase();
  if (m === "GET") return endsWithParam ? "byId" : "list";
  if (m === "POST") return endsWithParam ? null : "create";
  if (m === "PATCH" || m === "PUT") return "update";
  if (m === "DELETE") return "delete";
  return null;
}

function splitCamel(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function camelCase(parts: readonly string[]): string {
  return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");
}

/**
 * Strip a resource-name suffix from the operation name when the trailing
 * segment matches the deepest namespace segment. ``listCustomers`` under
 * ``customers`` becomes ``list``; ``releaseHold`` under ``customers.holds``
 * becomes ``release``.
 */
export function deriveVerb(
  operationName: string,
  namespaceTail: string | undefined,
  method: string,
  endsWithParam: boolean,
): string {
  const fallback = methodVerb(method, endsWithParam);
  if (!namespaceTail) return fallback ?? operationName;

  const parts = splitCamel(operationName);
  if (parts.length === 0) return fallback ?? operationName;

  const tail = namespaceTail.toLowerCase();
  const singular = tail.endsWith("s") ? tail.slice(0, -1) : tail;
  const last = parts[parts.length - 1] ?? "";
  if (last === tail || last === singular) {
    const stripped = parts.slice(0, -1).join("");
    if (stripped.length > 0) return lowerFirst(stripped);
    return fallback ?? operationName;
  }
  if (parts.length === 1) return parts[0] ?? operationName;
  return fallback ?? operationName;
}

export function computeNamespace(route: ProxyRouteDescriptor): NamespaceEntry {
  const segments = route.path.split("/").filter((seg) => seg.length > 0 && !isParamSegment(seg));
  const parts = route.path.split("/").filter((s) => s.length > 0);
  const last = parts[parts.length - 1];
  const trailingParam = last !== undefined && isParamSegment(last);
  const namespaceTail = segments[segments.length - 1];

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
    // Disambiguate collisions: same namespace + same verb → fall back to the
    // full camelCased operation name as the key, so both routes remain
    // reachable.
    let key = entry.verb;
    if (cursor.leaves.has(key)) {
      key = camelCase(splitCamel(entry.operationName));
    }
    cursor.leaves.set(key, entry);
  }
  return root;
}
