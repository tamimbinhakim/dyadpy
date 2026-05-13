// SSR helpers: framework-agnostic utilities for using a Tythe client during
// server-side rendering. Most of these are tiny — the value is having the
// canonical pattern documented and exported, not the line count.

/** Names of request headers that should usually be forwarded when calling a
 * Tythe-backed handler during SSR — covers cookie-based and bearer auth, the
 * common-case CSRF token, the request id used for cross-service tracing, and
 * common locale/forwarded headers used by gateways. */
export const DEFAULT_FORWARDED_HEADERS: readonly string[] = [
  "cookie",
  "authorization",
  "x-csrf-token",
  "x-request-id",
  "accept-language",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
] as const;

/** Pull a subset of headers off an incoming Request so they can be replayed
 * onto an outgoing Tythe call. Returns lowercase keys (the wire form).
 *
 * Use during SSR to forward auth / locale / tracing from the user's request
 * into the handler call your server-rendered page makes:
 *
 * @example
 * ```ts
 * // Next.js App Router server component
 * import { headers } from "next/headers";
 * import { forwardHeaders } from "@tythe/ts";
 *
 * export default async function Page() {
 *   const incoming = new Request("https://x/", { headers: await headers() });
 *   const me = await api.me({ headers: forwardHeaders(incoming) });
 *   return <Greeting name={me.name} />;
 * }
 * ```
 */
export function forwardHeaders(
  source: { headers: Headers } | Headers,
  names: readonly string[] = DEFAULT_FORWARDED_HEADERS,
): Record<string, string> {
  const headers = source instanceof Headers ? source : source.headers;
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = headers.get(name);
    if (value != null) out[name.toLowerCase()] = value;
  }
  return out;
}
