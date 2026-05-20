// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic over arbitrary callables
type AnyFn = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- match every function shape
type FirstArg<F> = F extends (a: infer A, ...rest: any[]) => unknown ? A : void;

export type UnaryKeys<TApi> = {
  [K in keyof TApi]: TApi[K] extends AnyFn
    ? ReturnType<TApi[K]> extends Promise<unknown>
      ? K
      : never
    : never;
}[keyof TApi];

export type StreamKeys<TApi> = {
  [K in keyof TApi]: TApi[K] extends AnyFn
    ? ReturnType<TApi[K]> extends AsyncIterable<unknown>
      ? K
      : never
    : never;
}[keyof TApi];

// Arg-less endpoints get `(opts?: CallOptions)` as their first param in the
// generated client. Detect that shape and surface `void` so the hook signature
// reads `useQuery("ping", undefined)` instead of leaking CallOptions.
type IsCallOptionsLike<T> = [T] extends [undefined]
  ? true
  : [Exclude<keyof NonNullable<T>, "signal" | "headers">] extends [never]
    ? true
    : false;

export type ArgsOf<F> = IsCallOptionsLike<FirstArg<F>> extends true ? void : FirstArg<F>;

type DataOfResolved<X> = Extract<X, { ok: true }> extends { data: infer T } ? T : X;
type ErrorOfResolved<X> = Extract<X, { ok: false }> extends { error: infer E } ? E : Error;

export type DataOf<F> = F extends AnyFn ? DataOfResolved<Awaited<ReturnType<F>>> : never;
export type ErrorOf<F> = F extends AnyFn ? ErrorOfResolved<Awaited<ReturnType<F>>> : Error;

export type StreamItemOf<F> = F extends AnyFn
  ? ReturnType<F> extends AsyncIterable<infer I>
    ? I
    : never
  : never;

export type QueryKeyOf<TApi, K extends UnaryKeys<TApi>> =
  ArgsOf<TApi[K]> extends void ? readonly [K] : readonly [K, ArgsOf<TApi[K]>];

export type MaybeArgs<TApi, K extends UnaryKeys<TApi>, TOptions> =
  ArgsOf<TApi[K]> extends void
    ? readonly [args?: undefined, options?: TOptions]
    : readonly [args: ArgsOf<TApi[K]>, options?: TOptions];

export type SubscriptionStatus = "idle" | "connecting" | "open" | "closed" | "error";
