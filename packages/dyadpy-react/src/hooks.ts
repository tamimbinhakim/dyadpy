import {
  mutationOptions as rqMutationOptions,
  queryOptions as rqQueryOptions,
  useMutation as useRQMutation,
  useQuery as useRQQuery,
  useSuspenseQuery as useRQSuspenseQuery,
} from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  UseSuspenseQueryOptions,
  UseSuspenseQueryResult,
} from "@tanstack/react-query";
import { unwrapResult } from "@dyadpy/ts";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ArgsOf,
  DataOf,
  ErrorOf,
  StreamItemOf,
  StreamKeys,
  SubscriptionStatus,
  UnaryKeys,
} from "./types.js";

type Unary = (args?: unknown, opts?: { signal?: AbortSignal }) => Promise<unknown>;
type Stream = (args?: unknown, opts?: { signal?: AbortSignal }) => AsyncIterable<unknown>;
type QueryHookOptions<TApi, K extends UnaryKeys<TApi>> = Omit<
  UseQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, DataOf<TApi[K]>, readonly unknown[]>,
  "queryKey" | "queryFn"
> & { queryKey?: readonly unknown[] };
type SuspenseQueryHookOptions<TApi, K extends UnaryKeys<TApi>> = Omit<
  UseSuspenseQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, DataOf<TApi[K]>, readonly unknown[]>,
  "queryKey" | "queryFn"
> & { queryKey?: readonly unknown[] };
type QueryHookArgs<TApi, K extends UnaryKeys<TApi>, TOptions> =
  ArgsOf<TApi[K]> extends void
    ? [args?: ArgsOf<TApi[K]>, options?: TOptions]
    : [args: ArgsOf<TApi[K]>, options?: TOptions];

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
  queryOptions: <K extends UnaryKeys<TApi>>(
    method: K,
    ...args: QueryHookArgs<TApi, K, QueryHookOptions<TApi, K>>
  ) => UseQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, DataOf<TApi[K]>, readonly unknown[]>;

  useQuery: <K extends UnaryKeys<TApi>>(
    method: K,
    ...args: QueryHookArgs<TApi, K, QueryHookOptions<TApi, K>>
  ) => UseQueryResult<DataOf<TApi[K]>, ErrorOf<TApi[K]>>;

  suspenseQueryOptions: <K extends UnaryKeys<TApi>>(
    method: K,
    ...args: QueryHookArgs<TApi, K, SuspenseQueryHookOptions<TApi, K>>
  ) => UseSuspenseQueryOptions<
    DataOf<TApi[K]>,
    ErrorOf<TApi[K]>,
    DataOf<TApi[K]>,
    readonly unknown[]
  >;

  useSuspenseQuery: <K extends UnaryKeys<TApi>>(
    method: K,
    ...args: QueryHookArgs<TApi, K, SuspenseQueryHookOptions<TApi, K>>
  ) => UseSuspenseQueryResult<DataOf<TApi[K]>, ErrorOf<TApi[K]>>;

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
  function queryOptions<K extends UnaryKeys<TApi>>(
    method: K,
    args?: ArgsOf<TApi[K]>,
    options?: QueryHookOptions<TApi, K>,
  ) {
    return rqQueryOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, DataOf<TApi[K]>, readonly unknown[]>({
      queryKey: [method, args],
      ...options,
      queryFn: async ({ signal }) => {
        const fn = api[method] as unknown as Unary;
        return unwrapResult(await fn(args as unknown, { signal })) as DataOf<TApi[K]>;
      },
    });
  }

  function useQuery<K extends UnaryKeys<TApi>>(
    method: K,
    args?: ArgsOf<TApi[K]>,
    options?: QueryHookOptions<TApi, K>,
  ) {
    return useRQQuery(queryOptions(method, args, options));
  }

  function suspenseQueryOptions<K extends UnaryKeys<TApi>>(
    method: K,
    args?: ArgsOf<TApi[K]>,
    options?: SuspenseQueryHookOptions<TApi, K>,
  ) {
    return queryOptions(method, args, options);
  }

  function useSuspenseQuery<K extends UnaryKeys<TApi>>(
    method: K,
    args?: ArgsOf<TApi[K]>,
    options?: SuspenseQueryHookOptions<TApi, K>,
  ) {
    return useRQSuspenseQuery(suspenseQueryOptions(method, args, options));
  }

  function mutationOptions<K extends UnaryKeys<TApi>>(
    method: K,
    options?: Omit<
      UseMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>,
      "mutationFn"
    >,
  ) {
    return rqMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>({
      ...options,
      mutationFn: async (vars) => {
        const fn = api[method] as unknown as Unary;
        return unwrapResult(await fn(vars as unknown)) as DataOf<TApi[K]>;
      },
    });
  }

  function useMutation<K extends UnaryKeys<TApi>>(
    method: K,
    options?: Omit<
      UseMutationOptions<DataOf<TApi[K]>, ErrorOf<TApi[K]>, ArgsOf<TApi[K]>>,
      "mutationFn"
    >,
  ) {
    return useRQMutation(mutationOptions(method, options));
  }

  function useSubscription<K extends StreamKeys<TApi>>(
    method: K,
    args: ArgsOf<TApi[K]>,
    options: UseDyadpySubscriptionOptions<StreamItemOf<TApi[K]>>,
  ): UseDyadpySubscriptionResult {
    const { enabled = true, onEvent, onOpen, onClose, onError } = options;
    const [status, setStatus] = useState<SubscriptionStatus>("idle");
    const [errorState, setError] = useState<unknown>(null);

    // Latest callbacks held in a ref so an inline `onEvent={(e) => ...}` doesn't
    // tear down the stream every render.
    const cb = useRef({ onEvent, onOpen, onClose, onError });
    cb.current = { onEvent, onOpen, onClose, onError };

    // Stable key over structurally-equal args.
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
    queryOptions,
    useQuery,
    suspenseQueryOptions,
    useSuspenseQuery,
    mutationOptions,
    useMutation,
    useSubscription,
  };
}

export const createDyadpyHooks = createReactClient;
export type DyadpyHooks<TApi> = ReactClient<TApi>;

function stableKey(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      // Fresh array from Object.keys — sorting in place is fine.
      // eslint-disable-next-line unicorn/no-array-sort
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = (v as Record<string, unknown>)[k];
      }
      return out;
    }
    return v;
  });
}
