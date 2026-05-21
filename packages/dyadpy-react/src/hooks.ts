/**
 * React hooks for Dyadpy clients.
 *
 * Single public entry: {@link createReactClient}. Pass the generated
 * `createApi(...)` result and the generated `_routes` array; get back a
 * tRPC-style nested namespace:
 *
 * ```ts
 * const api = createReactClient(apiClient, _routes);
 *
 * api.customers.list.useQuery({ limit: 50 });
 * api.customers.byId.useQuery({ id });
 * api.customers.create.useMutation();
 * api.customers.holds.list.useQuery({ id });
 * api.notifications.stream.useSubscription(args, { onEvent });
 * ```
 *
 * Naming rules live in `./proxy.ts`. The flat-key shape (`client.useQuery("listX")`)
 * that previous pre-releases exposed is gone; there is only one client now.
 */

import {
  mutationOptions,
  queryOptions,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseQueryOptions,
  UseSuspenseQueryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildNamespaceTree } from "./proxy.js";
import type { ProxyRouteDescriptor, TreeNode } from "./proxy.js";
import type { StreamItemOf, SubscriptionStatus } from "./types.js";

function makeQueryKey(method: string, args?: unknown): readonly unknown[] {
  return args === undefined ? [method] : [method, args];
}

type Unary = (args?: unknown, opts?: { signal?: AbortSignal }) => Promise<unknown>;
type Stream = (args?: unknown, opts?: { signal?: AbortSignal }) => AsyncIterable<unknown>;

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

/**
 * Permissive default type. The codegen-emitted `Operations` map will eventually
 * pivot through a TypeScript mapped type to give every leaf a tight signature;
 * for now the call surface is `any` and runtime correctness comes from the
 * `_routes` descriptors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested-proxy default surface
export type ReactClient = any;

export function createReactClient<TApi extends object>(
  api: TApi,
  routes: readonly ProxyRouteDescriptor[],
): ReactClient {
  // ---- internal flat-shape helpers (closure-scoped; not exported) ----------

  function makeQueryOptions(method: string, args?: unknown, options?: Partial<UseQueryOptions>) {
    return queryOptions({
      queryKey: options?.queryKey ?? makeQueryKey(method, args),
      ...options,
      queryFn: async ({ signal }) => {
        const fn = (api as Record<string, unknown>)[method] as Unary;
        return dataOrThrow(await fn(args, { signal }));
      },
    });
  }

  function makeUseQuery(method: string, args?: unknown, options?: Partial<UseQueryOptions>) {
    return useQuery(makeQueryOptions(method, args, options));
  }

  function makeSuspenseQueryOptions(
    method: string,
    args?: unknown,
    options?: Partial<UseSuspenseQueryOptions>,
  ) {
    return makeQueryOptions(method, args, options as Partial<UseQueryOptions>);
  }

  function makeUseSuspenseQuery(
    method: string,
    args?: unknown,
    options?: Partial<UseSuspenseQueryOptions>,
  ) {
    return useSuspenseQuery(
      makeSuspenseQueryOptions(method, args, options) as UseSuspenseQueryOptions,
    );
  }

  function makeMutationOptions(method: string, options?: Partial<UseMutationOptions>) {
    return mutationOptions({
      ...options,
      mutationFn: async (vars: unknown) => {
        const fn = (api as Record<string, unknown>)[method] as Unary;
        return dataOrThrow(await fn(vars));
      },
    });
  }

  function makeUseMutation(method: string, options?: Partial<UseMutationOptions>) {
    return useMutation(makeMutationOptions(method, options));
  }

  function makeUseSubscription<TEvent>(
    method: string,
    args: unknown,
    options: UseDyadpySubscriptionOptions<TEvent>,
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
          const fn = (api as Record<string, unknown>)[method] as Stream;
          const iter = fn(args, { signal: controller.signal });
          setStatus("open");
          cb.current.onOpen?.();
          for await (const ev of iter) {
            if (controller.signal.aborted) break;
            cb.current.onEvent(ev as TEvent);
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

  // ---- proxy assembly ------------------------------------------------------

  const tree = buildNamespaceTree(routes);
  return makeNodeProxy(tree);

  function makeNodeProxy(node: TreeNode): unknown {
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          const leaf = node.leaves.get(prop);
          if (leaf !== undefined) return makeLeaf(leaf.operationName);
          const child = node.children.get(prop);
          if (child !== undefined) return makeNodeProxy(child);
          return undefined;
        },
        ownKeys() {
          return [...node.children.keys(), ...node.leaves.keys()];
        },
        getOwnPropertyDescriptor() {
          return { enumerable: true, configurable: true };
        },
      },
    );
  }

  function makeLeaf(name: string) {
    return {
      queryKey: (args?: unknown) => makeQueryKey(name, args),
      queryOptions: (args?: unknown, options?: Partial<UseQueryOptions>) =>
        makeQueryOptions(name, args, options),
      useQuery: (args?: unknown, options?: Partial<UseQueryOptions>) =>
        makeUseQuery(name, args, options),
      suspenseQueryOptions: (args?: unknown, options?: Partial<UseSuspenseQueryOptions>) =>
        makeSuspenseQueryOptions(name, args, options),
      useSuspenseQuery: (args?: unknown, options?: Partial<UseSuspenseQueryOptions>) =>
        makeUseSuspenseQuery(name, args, options),
      mutationOptions: (options?: Partial<UseMutationOptions>) =>
        makeMutationOptions(name, options),
      useMutation: (options?: Partial<UseMutationOptions>) => makeUseMutation(name, options),
      useSubscription: <TEvent = StreamItemOf<unknown>>(
        args: unknown,
        options: UseDyadpySubscriptionOptions<TEvent>,
      ) => makeUseSubscription(name, args, options),
    };
  }
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
