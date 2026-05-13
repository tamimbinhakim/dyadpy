import type { QueryClient } from "@tanstack/react-query";
import { unwrapResult } from "@tythe/ts";

import type { ArgsOf, DataOf, UnaryKeys } from "./types.js";

/** The queryKey shape `createTytheHooks(...).useQuery(method, args)` uses. */
export function tytheQueryKey<TApi, K extends UnaryKeys<TApi> & string>(
  method: K,
  args: ArgsOf<TApi[K]>,
): readonly unknown[] {
  return [method, args];
}

/** Prefetch a single unary Tythe call into a QueryClient. */
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

/** Prefetch many Tythe calls in parallel into the same QueryClient. */
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
