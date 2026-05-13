// Server-side helpers for Tythe + React Query SSR.
//
// Use these from a Next.js App Router server component (or a server action) to
// prefetch a Tythe call into a QueryClient, dehydrate it, and hand it down to
// the client component tree via <HydrationBoundary>. The client-side
// `useTythe.useQuery(...)` hook uses the same `[method, args]` queryKey, so the
// data shows up as an instant cache hit on the first paint — no waterfall.
//
// Nothing in this file touches `window` / `document` / `localStorage`, so it
// is safe to import from a server component, an Edge runtime, or a Node CLI.

import type { QueryClient } from "@tanstack/react-query";
import { unwrapResult } from "@tythe/ts";

import type { ArgsOf, DataOf, UnaryKeys } from "./types.js";

/**
 * Build the queryKey that `createTytheHooks(...).useQuery(method, args)` uses.
 * Exported so server code can prefetch under the exact same key the client
 * hooks will look up.
 */
export function tytheQueryKey<TApi, K extends UnaryKeys<TApi> & string>(
  method: K,
  args: ArgsOf<TApi[K]>,
): readonly unknown[] {
  return [method, args];
}

/**
 * Prefetch a single unary Tythe call into the provided QueryClient. Returns
 * once the call resolves (success or failure — React Query stores both).
 *
 * @example
 * ```tsx
 * // app/users/[id]/page.tsx — server component
 * import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
 * import { prefetchTythe } from "@tythe/react/server";
 * import { api } from "@/lib/tythe/client";
 * import { UserCard } from "./UserCard"; // client component using `useTythe.useQuery("getUser", ...)`
 *
 * export default async function Page({ params }: { params: Promise<{ id: string }> }) {
 *   const { id } = await params;
 *   const qc = new QueryClient();
 *   await prefetchTythe(qc, api, "getUser", { userId: Number(id) });
 *   return (
 *     <HydrationBoundary state={dehydrate(qc)}>
 *       <UserCard userId={Number(id)} />
 *     </HydrationBoundary>
 *   );
 * }
 * ```
 */
export async function prefetchTythe<TApi extends object, K extends UnaryKeys<TApi> & string>(
  queryClient: QueryClient,
  api: TApi,
  method: K,
  args: ArgsOf<TApi[K]>,
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: tytheQueryKey<TApi, K>(method, args),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- proxy call shape
      const fn = api[method] as unknown as (a: unknown) => Promise<any>;
      return unwrapResult(await fn(args as unknown)) as DataOf<TApi[K]>;
    },
  });
}

/**
 * Prefetch many Tythe calls in parallel into the same QueryClient. Convenience
 * wrapper over `Promise.all(prefetches.map(prefetchTythe))` — handy when a
 * server-rendered page needs a fan-out of calls to render its initial state.
 *
 * Each entry's tuple shape is `[method, args]` — TypeScript narrows `args`
 * against the method's signature automatically.
 *
 * @example
 * ```tsx
 * await prefetchTytheMany(qc, api, [
 *   ["getUser", { userId: 1 }],
 *   ["listPosts", { authorId: 1, limit: 20 }],
 *   ["getInbox", undefined],
 * ]);
 * ```
 */
export async function prefetchTytheMany<TApi extends object>(
  queryClient: QueryClient,
  api: TApi,
  prefetches: ReadonlyArray<
    {
      [K in UnaryKeys<TApi> & string]: readonly [K, ArgsOf<TApi[K]>];
    }[UnaryKeys<TApi> & string]
  >,
): Promise<void> {
  await Promise.all(
    prefetches.map(([method, args]) => prefetchTythe(queryClient, api, method, args)),
  );
}
