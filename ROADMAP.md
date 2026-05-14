# Roadmap

This is what's shipping when. Priorities shift, the world is
unpredictable. But it's the most honest plan I have.

If you want to influence it, the highest-leverage move is to open an
issue saying "I tried to use Dyadpy for X and it didn't work because Y."
That's worth more than ten feature requests.

## v0.1 — Shipped

The bet: get the core loop right at the bottom level. Everything else
either rides on top or doesn't belong inside.

**Wire-level primitives**

- [x] `App` + `@app.{get,post,put,patch,delete}` route decorators.
- [x] Unary HTTP+JSON with msgspec validation.
- [x] Parameter location markers (`Path`, `Query`, `Header`, `Cookie`,
      `Body`, `File`, `Form`) via `Annotated[T, ...]`.
- [x] List-valued query params (`Annotated[list[T], Query()]`).
- [x] `Bytes` for raw request/response bodies (webhooks, downloads).
- [x] `Form()` marker for `application/x-www-form-urlencoded` and
      multipart bodies.
- [x] Multipart file uploads via `UploadFile` + `File()`.
- [x] `stream[T]` typed SSE with tagged-union events and cancellation.
- [x] `@raises(...)` typed errors → `Result<T, E>` discriminated union
      on the client.
- [x] `Context.set_status` / `set_header` / `set_cookie` / `after`
      response control.
- [x] Free `after(fn, *a, **kw)` post-response hook via contextvar.
- [x] `Depends(...)` DI compatible with the FastAPI shape.
- [x] `Pydantic` plugin (`dyadpy[pydantic]`) — runtime + IR auto-route
      Pydantic models through `model_validate` / `model_json_schema`.

**Codegen + tooling**

- [x] Type extraction → JSON-Schema-2020-12 IR via msgspec.
- [x] TypeScript codegen: single file, Proxy-based client, types,
      fetch wrapper, AbortSignal, snake_case ↔ camelCase translation.
- [x] `dyadpy dev` / `build` / `codegen` / `init` CLI.
- [x] `dyadpy openapi` — OpenAPI 3.1 export off the same IR.
- [x] `dyadpy swift` / `dyadpy kotlin` — working HTTP clients (typed
      args + responses, typed `@raises` enums, snake_case mapping).
- [x] `dyadpy deploy fly|render|modal` — thin wrapper around provider
      CLIs.

**Framework bindings (separate packages)**

- [x] `@dyadpy/ts` — the framework-agnostic runtime the codegen
      imports (zero deps, ~3 KB min+gz).
- [x] `@dyadpy/react` — `useQuery` / `useMutation` / `useSubscription`
      on TanStack Query.
- [x] `@dyadpy/svelte` — Svelte 5 store bindings.
- [x] `@dyadpy/solid` — SolidJS resource / signal bindings.

**Observability + tasks**

- [x] `dyadpy.otel.instrument(app)` — opt-in OpenTelemetry middleware.
- [x] `dyadpy.tasks.InMemoryBackend` + `TaskBackend` Protocol for
      background jobs. Redis / SQS adapters intentionally separate.

**Examples**

- [x] `examples/nextjs-streaming` — typed SSE end-to-end in <50 lines.
- [x] `examples/vite-react` — issue tracker exercising the full
      type-safety surface, plus a side-by-side **vs FastAPI** page.
- [x] `examples/sveltekit-counter` — `@dyadpy/svelte` end-to-end.

## v0.2 — Hardening + stable surface

Everything we'd want true before tagging 1.0. The shape of the surface
is mostly there; v0.2 is about removing rough edges.

- [x] **Better validation errors.** Field-level paths + offending
      value in the 422 body, both for msgspec and Pydantic.
- [x] **Generated-client diff in CI.** `dyadpy diff <old> <new>` flags
      removed routes / renamed fields / narrowed types as breaking.
- [x] **`Task[T]` wired into the runtime.** `mount_task_routes(app, path,
handler, backend=...)` registers `POST <path>` (submit) +
      `GET <path>/{task_id}` (status) + `GET <path>/{task_id}/events`
      (SSE) from one handler. TS codegen for a `useTask` hook is on
      v0.2.x; today clients call the three generated methods directly.
- [x] **Streaming `Last-Event-Id` resumption.** SSE handlers can carry
      ids; client passes them on reconnect. Production-grade streams
      without a separate package.
- [x] **Per-language SSE parsers in polyglot codegen.** Swift surfaces
      streams as `AsyncThrowingStream`; Kotlin as `Flow`. Inline SSE
      parsers, no extra dependency.
- [x] **WebSocket bidi (`bidi[Send, Recv]`).** Handler-side
      `BidiChannel[S, R]` + `@app.websocket(path)`. TS-side codegen
      lands in a v0.2.x point release.
- [x] **Pydantic deep parity.** `model_config` round-tripping,
      discriminated unions, computed fields.
- [x] **Coverage ≥ 85% across `dyadpy/*` source** (CI-enforced; the >90%
      goal is tracked as a continuous polish item, not a 0.2 blocker).
- [x] **3rd-party benchmark pass.** Identical handlers across Dyadpy /
      FastAPI / Litestar in [`benchmarks/`](benchmarks/), driven by a
      reproducible harness that prints cold-start + p50 / p95 / p99
      latency + req/s per scenario. Dyadpy wins cold start by ~2× on the
      reference machine; steady-state throughput sits within ~25% of
      both peers at concurrency 64.

## v0.3+ — Further out

Real, but unsized. Each lands when it earns its keep:

- [ ] Backpressure / flow-control hooks for streams.
- [ ] OpenAPI **import** — generate Dyadpy handler stubs from an
      existing OpenAPI doc. Migration path for FastAPI codebases.
- [ ] `dyadpy.observability` extra — Prometheus metrics + structured
      logging recipe (on top of the existing OTel middleware).
- [ ] Range requests / 206 Partial Content for `Bytes` responses.
- [ ] `Subscription[T]` — `useSubscription` with typed acks (separate
      from one-way SSE).

## v1.0 — Stability commitment

When we tag 1.0:

- [x] **Wire format frozen.** Backwards-compatible IR additions only; no
      field removals / renames without a deprecation cycle. The rules
      are spelled out in [`docs/ir-stability.md`](docs/ir-stability.md).
- [x] **Public API frozen for one minor release before breaking.**
      Removals and signature changes go through a deprecation cycle —
      see [`docs/semver.md`](docs/semver.md).
- [x] **Semver applies to runtime + codegen output.** A minor version
      bump must not break a working client. Codegen output is part of
      the surface, not an implementation detail.
- [x] **Documented LTS line.** Support windows + backport policy in
      [`docs/lts.md`](docs/lts.md).

Until 1.0: pre-release. Pin exact versions.

## Maintenance commitments (every release)

Below the feature work, the steady stuff:

- **Security.** CVEs in dependencies tracked weekly via Dependabot;
  patches land in a same-day point release.
- **Integrity of the IR / wire format.** Existing routes keep
  generating equivalent clients across minor versions.
- **Test gate.** Every PR runs ruff + mypy + pyright + pytest
  (Python) and oxlint + oxfmt + tsc + vitest (TS) on macOS + Linux +
  Windows. No regressions land.
- **Examples kept runnable.** CI starts each example's server and
  runs a smoke `curl` against the typed routes.

## Meta-frameworks territory — deliberately outside core

These are real, useful patterns. They don't belong inside `dyadpy`
because they carry opinion about how an app is structured. They belong
in a meta-framework that sits on top of the IR and the runtime —
possibly one we ship separately (working title: `dyadpy-kit`).

- **File-based routing.** Scan a `routes/` tree, register handlers by
  filename, hot-reload on change. Pure convenience layer over `App`.
- **Monorepo scaffolds.** `npx create-dyadpy-app` with a baked-in
  Next.js / Vite / SvelteKit frontend wired to a Python server.
- **Auth presets.** A `dyadpy-auth-clerk` / `dyadpy-auth-nextauth` that
  wires `Depends(current_user)` for you.
- **AI / LLM templates.** Token-streaming routes, tool-call shapes,
  rate-limited inference endpoints — opinion-heavy, separate package.
- **Admin UIs / dashboards** generated from the IR.

The IR (`dyadpy.ir`) and the CLI codegen entry points are deliberately
designed to make these buildable from outside. If you'd like to ship
one, open an issue — happy to help shape the seams.

## Won't do (probably)

Some lines I'm holding for now. If enough people push back I'll
reconsider — but the default is no.

- **A `dyadpy.ai` module / LLM-specific types.** Dyadpy ships at the
  fundamental level: RPC, streaming, errors, cancellation. LLM tokens,
  tool calls, agent state, structured outputs — those are user code or
  a separate plugin (`dyadpy-llm`, community-maintained).
- **WebSockets as the default streaming transport.** SSE is enough,
  simpler, and matches what every major server-push protocol
  standardized on. WS is opt-in via `bidi[S, R]`.
- **A monorepo template that bundles Next.js.** Bring your own
  frontend. Dyadpy writes a file into your `src/`. That's it.
- **GraphQL support.** Different mental model. Scope balloon.
- **A managed hosted service.** Dyadpy is a library. Modal / Fly /
  Render handle hosting just fine.

## Influences

In rough order of "how much I stole from each":

- **tRPC** — for the Proxy client UX and the "the type _is_ the
  contract" idea.
- **Encore.ts** — for the proof that parse-types-and-codegen works.
- **FastAPI** — for the `Depends()` DI pattern and the dev-loop
  ergonomics.
- **Litestar** — for showing that msgspec-first ASGI is viable.
- **TanStack Query** — for the bar on what good client-side data
  ergonomics looks like.

If you've worked on one of these and have opinions about what we
should steal next, please open an issue.
