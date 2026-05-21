// Generic-args helpers retained for backward compat with consumers that
// authored their own thin wrappers around the dyadpy types. `createReactClient`
// now maps the generated nested `ApiRoutes` type directly; these helpers remain
// useful for standalone wrappers.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic over arbitrary callables
type AnyFn = (...args: any[]) => any;

export type StreamItemOf<F> = F extends AnyFn
  ? ReturnType<F> extends AsyncIterable<infer I>
    ? I
    : never
  : never;

export type SubscriptionStatus = "idle" | "connecting" | "open" | "closed" | "error";
