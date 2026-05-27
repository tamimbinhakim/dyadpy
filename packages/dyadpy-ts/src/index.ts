// Deprecated shim. `@dyadpy/ts` has been renamed to `@causewayjs/ts`.
//
// This package re-exports everything from `@causewayjs/ts` so existing imports
// keep resolving while you migrate. It will be removed in a future
// causeway release.

// `DyadpyError` was renamed to `CausewayError`. Both names are re-exported
// so `import { DyadpyError }` keeps working.

export {
  CausewayError,
  CausewayError as DyadpyError,
  createLazyClient,
  DEFAULT_FORWARDED_HEADERS,
  forwardHeaders,
  parseSSE,
  unwrapResult,
} from "@causewayjs/ts";

export type {
  CallOptions,
  Err,
  HeaderRecord,
  HeaderRecordValue,
  HeaderSource,
  HeadersLike,
  HttpMethod,
  LazyClientConfig,
  Ok,
  ParamDescriptor,
  ParamLocation,
  Result,
  RouteDescriptor,
  RouteMeta,
} from "@causewayjs/ts";
