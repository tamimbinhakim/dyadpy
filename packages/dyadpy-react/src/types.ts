// Generic-args helpers retained for backward compat with consumers that
// authored their own thin wrappers around the dyadpy types. None of them are
// part of the proxy surface in `createReactClient`; that one is intentionally
// loose (`any` leaves) until codegen emits a nested operations map.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic over arbitrary callables
type AnyFn = (...args: any[]) => any;

export type StreamItemOf<F> = F extends AnyFn
  ? ReturnType<F> extends AsyncIterable<infer I>
    ? I
    : never
  : never;

export type SubscriptionStatus = "idle" | "connecting" | "open" | "closed" | "error";
