# Architecture

This is what's actually happening when you type `dyadpy dev`. It's not magic,
and the parts are small enough that you can read the whole thing in a
weekend.

## The 30-second mental model

```
your Python handlers
        │
        ▼
   IR Builder           (inspect + typing.get_type_hints + msgspec schema)
        │
        ▼
    AppIR  ──►  ASGI runtime  ──►  HTTP / SSE
        │
        ▼
    Codegen        (IR → generated client/)
        │
        ▼
your frontend's src/lib/dyadpy/client/
        │
        ▼
    @dyadpy/ts    (~3 KB runtime, nested dispatch + SSE)
```

Two flows: **server start** rebuilds the IR and writes `client/`; **at
request time** the ASGI runtime decodes via msgspec, calls your handler,
encodes the response.

## Layer by layer

### 1. `App` and route registration (`dyadpy/app.py`)

The `App` is a plain dataclass with a list of `Route` records. Decorators
(`@app.get`, `@app.post`, …) just append to the list. There are no globals,
no metaclasses, no import-time side effects.

```python
app = App()

@app.get("/users/{user_id}")
async def get_user(user_id: int) -> User: ...
```

Why this matters: tests can build an `App`, populate it, introspect it, and
throw it away — all without booting a server.

### 2. IR extraction (`dyadpy/ir.py`)

At server start (and on every reload) the IR builder walks each `Route`:

1. `inspect.signature(handler)` → parameter names, defaults, kinds.
2. `typing.get_type_hints(handler, include_extras=True)` → resolved
   annotations, including `Annotated[T, Body()|Query()|Path()|Header()]`.
3. `msgspec.json.schema_components([...])` → JSON Schema 2020-12 fragments
   that share `$ref`-style components for repeated types.
4. Return-type analysis: `AsyncIterator[T]` (or the friendlier
   `stream[T]`) → a streaming endpoint; `Task[T]` → long-running.
5. `dyadpy.errors.get_declared_raises(handler)` → the typed-error union.

The output is a plain dataclass tree (`AppIR`) — serializable to JSON,
inspectable in the REPL, easy to snapshot in tests.

### 3. ASGI transport (`dyadpy/app.py` + Starlette under the hood)

The runtime is Starlette underneath. We don't reinvent routing, ASGI
lifespan, or middleware — that ecosystem is solid.

For each request:

1. Match path → `Route` → `RouteIR`.
2. Decode body with `msgspec.json.decode` against the route's input schema.
   No allocator-heavy model wrapping — msgspec gives us a `Struct` directly.
3. Resolve `Depends(...)` if present.
4. Call the handler.
5. Encode the return value with `msgspec.json.encode`. For streaming
   handlers, wrap in `EventSourceResponse` and yield tagged frames.

For typed errors: if the handler raises one of the exceptions declared in
`@raises(...)`, the runtime wraps it in the `Result` envelope. Exceptions with
a numeric `status` attribute use that HTTP status; otherwise the compatibility
default is 200. `request.state.request_id`, when present, is copied onto the
error payload. Anything undeclared is not converted into `Result`; it logs a
compact server-side traceback and returns a scrubbed 500 payload with the same
request id when available.

### 4. Codegen (`dyadpy/codegen.py`)

Codegen reads an `AppIR` and emits an optimized TypeScript client directory. The strategy:

- **Types**: every msgspec `Struct` / `TypedDict` / `dataclass` becomes a
  `type` declaration; shared types are deduped via the components map.
- **Discriminated unions**: msgspec `tag=` becomes a TS `kind: "..."` field
  so narrowing works the way TS expects.
- **Streaming**: an endpoint with `stream[T]` becomes a method returning
  `AsyncIterable<T>` (or, for tagged unions, the narrowed shape).
- **Errors**: `@raises(A, B)` becomes `Result<T, A | B>`. The client is
  forced to handle the typed cases.
- **The client object**: `index.ts` calls `createLazyClient<ApiRoutes>({ routeMeta, loadRoute })`
  to build the same nested object that `ApiRoutes` describes, so calls like
  `api.users.byId` are static in TypeScript and real properties at runtime.
- **Runtime splitting**: `meta.ts` contains only small route metadata; full
  descriptors live under `routes/` and are loaded on the first call to each
  route.

The public import is still one path: `@/lib/dyadpy/client`. Under that path,
the generated folder keeps types and descriptors separate so tools like
Turbopack do not transform a huge single module for every page.

### 5. The dev loop (`dyadpy/cli.py` + `watchfiles`)

`dyadpy dev` owns the development server instead of delegating reloads to a
child process:

1. Start uvicorn once around a hot-swappable ASGI wrapper.
2. Watch `*.py` with `watchfiles`.
3. On change, evict app-local modules, reload the target app, rebuild IR, and
   write the codegen output atomically (write tmp →
   `rename`) so your TS toolchain never reads a half-written file.
4. Swap the new app snapshot in only after the rebuild succeeds. Existing
   requests continue on the previous snapshot; failed reloads keep serving the
   last good app.

Everything is logged with `rich` so the terminal stays readable: changed files,
reload timing, route count, concise failures, and request lines.

### 6. The TS runtime (`@dyadpy/ts`)

The runtime is ~3 KB min+gz. It exports:

- `createLazyClient<TApi>(config)` → a nested object that dispatches
  `api.<namespace>.<verb>(...)` after lazily loading the matching route
  descriptor.
- `parseSSE(stream)` → a minimal SSE parser. Used by the generated client
  to turn `fetch().body` into a typed `AsyncIterable<TEvent>`.
- `Result<T, E>` / `Ok<R>` / `Err<R>` → the envelope type and the helpers
  for unwrapping a route's success and error type from its return.

Zero dependencies. ESM-first. Side-effect-free. Tree-shakable.

## Why this shape

A few decisions I want to call out explicitly.

**Why an IR at all, instead of inspect → string?**
Because polyglot. The IR is JSON Schema 2020-12 with a thin Dyadpy layer for
streams/errors/tasks. The day someone wants a Swift or Kotlin client, we
walk the same IR with a different renderer.

**Why msgspec over Pydantic by default?**
Speed and tightness of the JSON Schema output. msgspec is 2–30× faster than
Pydantic v2 on the codecs that matter for high-throughput endpoints, and its
schema export is conservative and predictable. Pydantic ships as a
first-class plugin (`dyadpy[pydantic]`) for users who want it.

**Why SSE for streaming, not WebSockets?**
Browser support is built in (`EventSource`), it passes proxies cleanly, and
most server-push protocols have standardized on it. WS opens you up to
bidirectional state-management complexity that most apps don't need. WS is
on the roadmap (`bidi[Send, Recv]`) for the cases that actually want it.

**Why lazy route chunks instead of generated fetch functions?**
Static interfaces describe the nested dot path, while route metadata lets the
runtime build the matching object and share one request implementation for
JSON, forms, files, bytes, and SSE. The heavy descriptor data is split by route
namespace and loaded only when a call needs it.

## Where to read the code

- [`packages/dyadpy/src/dyadpy/app.py`](../packages/dyadpy/src/dyadpy/app.py)
- [`packages/dyadpy/src/dyadpy/ir.py`](../packages/dyadpy/src/dyadpy/ir.py)
- [`packages/dyadpy/src/dyadpy/codegen.py`](../packages/dyadpy/src/dyadpy/codegen.py)
- [`packages/dyadpy/src/dyadpy/streaming.py`](../packages/dyadpy/src/dyadpy/streaming.py)
- [`packages/dyadpy/src/dyadpy/cli.py`](../packages/dyadpy/src/dyadpy/cli.py)
- [`packages/dyadpy-ts/src/`](../packages/dyadpy-ts/src)

If you read all of those and still have a "wait, how does X work?" question,
that's a docs bug. Please file it.
