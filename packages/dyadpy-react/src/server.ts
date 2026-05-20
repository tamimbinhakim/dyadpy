import type { FetchQueryOptions, QueryClient } from "@tanstack/react-query";

import type { ArgsOf, DataOf, ErrorOf, QueryKeyOf, UnaryKeys } from "./types.js";

export function getQueryKey<TApi, K extends UnaryKeys<TApi> & string>(
  method: K,
  args?: ArgsOf<TApi[K]>,
): QueryKeyOf<TApi, K> {
  return (args === undefined ? [method] : [method, args]) as unknown as QueryKeyOf<TApi, K>;
}

export async function prefetchQuery<TApi extends object, K extends UnaryKeys<TApi> & string>(
  queryClient: QueryClient,
  api: TApi,
  method: K,
  args?: ArgsOf<TApi[K]>,
  options?: Omit<
    FetchQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, DataOf<TApi[K]>, QueryKeyOf<TApi, K>>,
    "queryKey" | "queryFn"
  >,
): Promise<void> {
  await queryClient.prefetchQuery({
    ...options,
    queryKey: getQueryKey<TApi, K>(method, args),
    queryFn: async ({ signal }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- proxy call shape
      const fn = api[method] as unknown as (
        a: unknown,
        opts?: { signal?: AbortSignal },
      ) => Promise<unknown>;
      return dataOrThrow(await fn(args as unknown, { signal })) as DataOf<TApi[K]>;
    },
  });
}

export async function prefetchQueries<TApi extends object>(
  queryClient: QueryClient,
  api: TApi,
  prefetches: ReadonlyArray<
    {
      [K in UnaryKeys<TApi> & string]: readonly [K, ArgsOf<TApi[K]>];
    }[UnaryKeys<TApi> & string]
  >,
): Promise<void> {
  await Promise.all(
    prefetches.map(([method, args]) => prefetchQuery(queryClient, api, method, args)),
  );
}

function dataOrThrow(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (!("ok" in value)) return value;
  if (value.ok === true && "data" in value) return value.data;
  if (value.ok === false && "error" in value) throw value.error;
  return value;
}
