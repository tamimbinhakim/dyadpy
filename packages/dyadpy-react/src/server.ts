/**
 * Server-side helpers. The proxy returned by ``createReactClient`` is safe to
 * import in server code as long as you only touch the non-hook surface —
 * ``api.x.y.queryOptions(args)``, ``api.x.y.queryKey(args)``, etc. Pass those
 * straight into the React Query client:
 *
 * ```ts
 * await queryClient.prefetchQuery(api.customers.list.queryOptions({ limit: 50 }));
 * ```
 *
 * The bulk helper below covers the common multi-prefetch shape.
 */
import type { FetchQueryOptions, QueryClient } from "@tanstack/react-query";

export interface PrefetchableLeaf {
  queryOptions: (args?: unknown, options?: unknown) => FetchQueryOptions;
}

export async function prefetchQueries(
  queryClient: QueryClient,
  leaves: ReadonlyArray<readonly [PrefetchableLeaf, unknown?]>,
): Promise<void> {
  await Promise.all(
    leaves.map(([leaf, args]) => queryClient.prefetchQuery(leaf.queryOptions(args))),
  );
}
