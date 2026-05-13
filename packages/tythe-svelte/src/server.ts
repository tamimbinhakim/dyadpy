// Server-side helpers for Tythe + SvelteKit SSR.
//
// SvelteKit's `load` functions run in Node on the server (and in the browser
// during client navigation). For server-only loads (`+page.server.ts` /
// `+layout.server.ts`) you typically want to forward the incoming request's
// cookies + auth headers to the Tythe handler, then return the resolved data
// straight to the page — SvelteKit serializes it into the rendered HTML and
// rehydrates it on the client with no extra round-trip.
//
// Nothing here imports `$app/...` or `@sveltejs/kit` so it works in any
// Node-ish runtime, including unit tests.

import { forwardHeaders } from "@tythe/ts";

import type { ArgsOf, DataOf, UnaryKeys } from "./types.js";

type Unary = (args?: unknown, opts?: { headers?: Record<string, string> }) => Promise<unknown>;

/**
 * Minimal subset of `RequestEvent` we need to forward auth/locale headers.
 * Typed structurally so it's compatible with both `RequestEvent` and
 * `LoadEvent` shapes without importing `@sveltejs/kit`.
 */
export interface SvelteRequestLike {
  request: Request;
}

/**
 * Invoke a Tythe method on the server, forwarding auth/locale/tracing headers
 * from the incoming SvelteKit request. The return shape is the route's `data`
 * (after `Result` unwrapping, when applicable).
 *
 * @example
 * ```ts
 * // src/routes/me/+page.server.ts
 * import { api } from "$lib/tythe/client";
 * import { tytheLoad } from "@tythe/svelte/server";
 *
 * export const load = async (event) => ({
 *   me: await tytheLoad(api, "me", undefined, event),
 * });
 * ```
 */
export async function tytheLoad<TApi extends object, K extends UnaryKeys<TApi> & string>(
  api: TApi,
  method: K,
  args: ArgsOf<TApi[K]>,
  event: SvelteRequestLike,
  options: { forwardHeaders?: readonly string[] } = {},
): Promise<DataOf<TApi[K]>> {
  const headers = forwardHeaders(event.request, options.forwardHeaders);
  const fn = api[method] as unknown as Unary;
  const value = await fn(args as unknown, { headers });
  return unwrapEnvelope(value) as DataOf<TApi[K]>;
}

function unwrapEnvelope(value: unknown): unknown {
  // Local copy of @tythe/ts's `unwrapResult` so we don't need a runtime export
  // here — the inline form is short and the server bundle stays tree-shakable.
  if (value === null || typeof value !== "object") return value;
  const e = value as { ok?: unknown; data?: unknown; error?: unknown };
  if (typeof e.ok !== "boolean" || (!("data" in e) && !("error" in e))) return value;
  if (e.ok) return e.data;
  throw e.error;
}
