import {
  mutationOptions,
  queryOptions,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  UseSuspenseQueryResult,
  UseSuspenseQueryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ArgsOf,
  DataOf,
  ErrorOf,
  MaybeArgs,
  QueryKeyOf,
  StreamItemOf,
  StreamKeys,
  SubscriptionStatus,
  UnaryKeys,
} from "./types.js";

type Unary = (args?: unknown, opts?: { signal?: AbortSignal }) => Promise<unknown>;
type Stream = (args?: unknown, opts?: { signal?: AbortSignal }) => AsyncIterable<unknown>;
type QueryHookOptions<TApi, K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>> = Omit<
  UseQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, TSelected, QueryKeyOf<TApi, K>>,
  "queryKey" | "queryFn"
> & { queryKey?: QueryKeyOf<TApi, K> };
type SuspenseQueryHookOptions<TApi, K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>> = Omit<
  UseSuspenseQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, TSelected, QueryKeyOf<TApi, K>>,
  "queryKey" | "queryFn"
> & { queryKey?: QueryKeyOf<TApi, K> };

export interface UseDyadpySubscriptionOptions<TEvent> {
  enabled?: boolean;
  onEvent: (event: TEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
}

export interface UseDyadpySubscriptionResult {
  status: SubscriptionStatus;
  error: unknown;
}

export interface ReactClient<TApi> {
  queryKey: <K extends UnaryKeys<TApi>>(method: K, args?: ArgsOf<TApi[K]>) => QueryKeyOf<TApi, K>;

  queryOptions: <K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...args: MaybeArgs<TApi, K, QueryHookOptions<TApi, K, TSelected>>
  ) => UseQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, TSelected, QueryKeyOf<TApi, K>>;

  useQuery: <K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...args: MaybeArgs<TApi, K, QueryHookOptions<TApi, K, TSelected>>
  ) => UseQueryResult<TSelected, ErrorOf<TApi[K]>>;

  suspenseQueryOptions: <K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...args: MaybeArgs<TApi, K, SuspenseQueryHookOptions<TApi, K, TSelected>>
  ) => UseSuspenseQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, TSelected, QueryKeyOf<TApi, K>>;

  useSuspenseQuery: <K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...args: MaybeArgs<TApi, K, SuspenseQueryHookOptions<TApi, K, TSelected>>
  ) => UseSuspenseQueryResult<TSelected, ErrorOf<TApi[K]>>;

  mutationOptions: <K extends UnaryKeys<TApi>>(
    method: K,
    options?: Omit<
      UseMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>,
      "mutationFn"
    >,
  ) => UseMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>;

  useMutation: <K extends UnaryKeys<TApi>>(
    method: K,
    options?: Omit<
      UseMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>,
      "mutationFn"
    >,
  ) => UseMutationResult<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>;

  useSubscription: <K extends StreamKeys<TApi>>(
    method: K,
    args: ArgsOf<TApi[K]>,
    options: UseDyadpySubscriptionOptions<StreamItemOf<TApi[K]>>,
  ) => UseDyadpySubscriptionResult;
}

export function createReactClient<TApi extends object>(api: TApi): ReactClient<TApi> {
  function queryKey<K extends UnaryKeys<TApi>>(
    method: K,
    args?: ArgsOf<TApi[K]>,
  ): QueryKeyOf<TApi, K> {
    return (args === undefined ? [method] : [method, args]) as unknown as QueryKeyOf<TApi, K>;
  }

  function getQueryOptions<K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...hookArgs: MaybeArgs<TApi, K, QueryHookOptions<TApi, K, TSelected>>
  ) {
    const [args, options] = splitArgs(hookArgs);
    return queryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, TSelected, QueryKeyOf<TApi, K>>({
      queryKey: options?.queryKey ?? queryKey(method, args as ArgsOf<TApi[K]>),
      ...options,
      queryFn: async ({ signal }) => {
        const fn = api[method] as unknown as Unary;
        return dataOrThrow(await fn(args as unknown, { signal })) as DataOf<TApi[K]>;
      },
    });
  }

  function getUseQuery<K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...args: MaybeArgs<TApi, K, QueryHookOptions<TApi, K, TSelected>>
  ) {
    return useQuery(getQueryOptions<K, TSelected>(method, ...args)) as UseQueryResult<
      TSelected,
      ErrorOf<TApi[K]>
    >;
  }

  function getSuspenseQueryOptions<K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...args: MaybeArgs<TApi, K, SuspenseQueryHookOptions<TApi, K, TSelected>>
  ) {
    return getQueryOptions<K, TSelected>(method, ...args) as UseSuspenseQueryOptions<
      DataOf<TApi[K]>,
      ErrorOf<TApi[K]>,
      TSelected,
      QueryKeyOf<TApi, K>
    >;
  }

  function getUseSuspenseQuery<K extends UnaryKeys<TApi>, TSelected = DataOf<TApi[K]>>(
    method: K,
    ...args: MaybeArgs<TApi, K, SuspenseQueryHookOptions<TApi, K, TSelected>>
  ) {
    return useSuspenseQuery(getSuspenseQueryOptions(method, ...args)) as UseSuspenseQueryResult<
      TSelected,
      ErrorOf<TApi[K]>
    >;
  }

  function getMutationOptions<K extends UnaryKeys<TApi>>(
    method: K,
    options?: Omit<
      UseMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>,
      "mutationFn"
    >,
  ) {
    return mutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>({
      ...options,
      mutationFn: async (vars) => {
        const fn = api[method] as unknown as Unary;
        return dataOrThrow(await fn(vars as unknown)) as DataOf<TApi[K]>;
      },
    });
  }

  function getUseMutation<K extends UnaryKeys<TApi>>(
    method: K,
    options?: Omit<
      UseMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>,
      "mutationFn"
    >,
  ) {
    return useMutation(getMutationOptions(method, options));
  }

  function useSubscription<K extends StreamKeys<TApi>>(
    method: K,
    args: ArgsOf<TApi[K]>,
    options: UseDyadpySubscriptionOptions<StreamItemOf<TApi[K]>>,
  ): UseDyadpySubscriptionResult {
    const { enabled = true, onEvent, onOpen, onClose, onError } = options;
    const [status, setStatus] = useState<SubscriptionStatus>("idle");
    const [errorState, setError] = useState<unknown>(null);

    const cb = useRef({ onEvent, onOpen, onClose, onError });
    cb.current = { onEvent, onOpen, onClose, onError };
    const argsKey = useMemo(() => stableKey(args), [args]);

    useEffect(() => {
      if (!enabled) {
        setStatus("idle");
        return;
      }
      const controller = new AbortController();
      setStatus("connecting");
      setError(null);

      void (async () => {
        try {
          const fn = api[method] as unknown as Stream;
          const iter = fn(args as unknown, { signal: controller.signal });
          setStatus("open");
          cb.current.onOpen?.();
          for await (const ev of iter) {
            if (controller.signal.aborted) break;
            cb.current.onEvent(ev as StreamItemOf<TApi[K]>);
          }
          if (controller.signal.aborted) return;
          setStatus("closed");
          cb.current.onClose?.();
        } catch (error) {
          if (controller.signal.aborted) return;
          setError(error);
          setStatus("error");
          cb.current.onError?.(error);
        }
      })();

      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, method, argsKey]);

    return { status, error: errorState };
  }

  return {
    queryKey,
    queryOptions: getQueryOptions,
    useQuery: getUseQuery,
    suspenseQueryOptions: getSuspenseQueryOptions,
    useSuspenseQuery: getUseSuspenseQuery,
    mutationOptions: getMutationOptions,
    useMutation: getUseMutation,
    useSubscription,
  };
}

export const createDyadpyHooks = createReactClient;
export type DyadpyHooks<TApi> = ReactClient<TApi>;

function splitArgs<TArgs, TOptions>(
  args: readonly [args?: TArgs | undefined, options?: TOptions],
): [TArgs | undefined, TOptions | undefined] {
  return [args[0] as TArgs | undefined, args[1]];
}

function stableKey(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      for (const k of sortedKeys(v as Record<string, unknown>)) {
        out[k] = (v as Record<string, unknown>)[k];
      }
      return out;
    }
    return v;
  });
}

function sortedKeys(value: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(value)) {
    const index = keys.findIndex((current) => current > key);
    if (index === -1) {
      keys.push(key);
    } else {
      keys.splice(index, 0, key);
    }
  }
  return keys;
}

function dataOrThrow(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (!("ok" in value)) return value;
  if (value.ok === true && "data" in value) return value.data;
  if (value.ok === false && "error" in value) throw value.error;
  return value;
}
