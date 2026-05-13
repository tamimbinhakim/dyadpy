// Server-side helpers for Tythe + SolidStart SSR.
//
// SolidStart runs server functions and route loaders in Node. The pattern
// here mirrors the SvelteKit helper: take the incoming Request, forward
// cookies/auth/tracing headers to the Tythe handler, return the unwrapped
// data. No SolidStart import — works wherever you have a `Request`.

import { forwardHeaders } from "@tythe/ts";

import type { ArgsOf, DataOf, UnaryKeys } from "./types.js";

type Unary = (args?: unknown, opts?: { headers?: Record<string, string> }) => Promise<unknown>;

/**
 * Invoke a Tythe method on the server with headers forwarded from the
 * incoming request. Use from a SolidStart server function or a route
 * loader (`createAsync(() => ...)`) that needs auth-aware initial data.
 *
 * @example
 * ```ts
 * // src/routes/me.tsx
 * import { getRequestEvent } from "solid-js/web";
 * import { tytheServerCall } from "@tythe/solid/server";
 * import { api } from "~/lib/tythe/client";
 *
 * export const fetchMe = () => {
 *   const event = getRequestEvent();
 *   if (!event) throw new Error("server-only");
 *   return tytheServerCall(api, "me", undefined, event.request);
 * };
 * ```
 */
export async function tytheServerCall<TApi extends object, K extends UnaryKeys<TApi> & string>(
  api: TApi,
  method: K,
  args: ArgsOf<TApi[K]>,
  request: Request,
  options: { forwardHeaders?: readonly string[] } = {},
): Promise<DataOf<TApi[K]>> {
  const headers = forwardHeaders(request, options.forwardHeaders);
  const fn = api[method] as unknown as Unary;
  const value = await fn(args as unknown, { headers });
  return unwrapEnvelope(value) as DataOf<TApi[K]>;
}

function unwrapEnvelope(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const e = value as { ok?: unknown; data?: unknown; error?: unknown };
  if (typeof e.ok !== "boolean" || (!("data" in e) && !("error" in e))) return value;
  if (e.ok) return e.data;
  throw e.error;
}
