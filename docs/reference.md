# Reference

Every primitive Tythe exports, what it does, and the smallest example. If a
feature isn't here, it isn't in `tythe`.

Tythe ships at the wire level: HTTP routes, body / param markers, typed
streaming, typed errors, post-response hooks. Nothing higher-level (no
auth, no rate-limiting, no LLM types).

- [App + decorators](#app--decorators)
- [Parameter markers (`Annotated[T, ...]`)](#parameter-markers)
- [Request body shapes (JSON, `Bytes`, `Form`, file)](#request-body-shapes)
- [Response control (`Context.set_status` / `set_header` / `set_cookie`)](#response-control)
- [Typed errors (`@raises`)](#typed-errors)
- [Streaming (`stream[T]`)](#streaming)
- [Dependency injection (`Depends`)](#dependency-injection)
- [Post-response hooks (`after()`)](#post-response-hooks)
- [Background jobs (`TaskBackend`)](#background-jobs)
- [Observability (`tythe.otel`)](#observability)
- [OpenAPI + polyglot codegen (CLI)](#openapi--polyglot-codegen)

---

## App + decorators

```python
from tythe import App

app = App()

@app.get("/users/{user_id}")
@app.post("/posts")
@app.put("/users/{user_id}")
@app.patch("/users/{user_id}")
@app.delete("/users/{user_id}")
async def handler(...): ...
```

Each decorator registers a route and infers parameter locations from
annotations + the path template.

## Parameter markers

Inside `Annotated[T, ...]`. Tell Tythe where a value lives on the wire.

```python
from typing import Annotated
from tythe.params import Body, Cookie, File, Form, Header, Path, Query, UploadFile

@app.post("/posts/{post_id}/comments")
async def add_comment(
    post_id: int,                                       # path (inferred from template)
    body: Annotated[str, Body()],                       # JSON body field
    cursor: Annotated[str | None, Query()] = None,      # ?cursor=...
    if_match: Annotated[str, Header("If-Match")] = "",  # request header
    session: Annotated[str, Cookie()] = "",             # request cookie
    avatar: Annotated[UploadFile, File()] = None,       # multipart upload
): ...
```

Without an explicit marker:

- path-template names (`{post_id}`) → `Path`
- structural types (msgspec.Struct / dataclass / TypedDict / Pydantic) → `Body`
- everything else → `Query`

### List-valued query params

```python
@app.get("/issues")
async def list_issues(
    tag: Annotated[list[str], Query()] = None,  # ?tag=bug&tag=ui  →  ["bug", "ui"]
    status: Annotated[list[Status], Query()] = None,
) -> Page: ...
```

Missing or `None` default → empty list. TS client expands array args back into
repeated `?tag=a&tag=b` keys.

## Request body shapes

### JSON (default)

```python
class CreatePost(msgspec.Struct):
    title: str
    body: str

@app.post("/posts")
async def create_post(data: CreatePost) -> Post: ...
```

Multi-field embedded:

```python
@app.post("/login")
async def login(
    email: Annotated[str, Body()],
    password: Annotated[str, Body()],
) -> Session: ...
```

### Raw bytes — `Bytes`

```python
from tythe import Bytes

@app.post("/webhooks/stripe")
async def stripe_webhook(
    body: Bytes,
    signature: Annotated[str, Header("stripe-signature")],
) -> None: ...

@app.get("/exports/{id}.csv")
async def export(id: str) -> Bytes:
    return render_csv(id)
```

Skips the JSON envelope on both sides. TS client passes
`Blob | Uint8Array | ArrayBuffer` through, decodes responses with `res.blob()`.
Content-Type defaults to `application/octet-stream` (override via `set_header`).

### Form — `Annotated[T, Form()]`

```python
import msgspec
from tythe import Form

class LoginForm(msgspec.Struct):
    email: str
    password: str
    remember_me: bool = False

@app.post("/login")
async def login(form: Annotated[LoginForm, Form()]) -> Session: ...
```

Reads `application/x-www-form-urlencoded` (or `multipart/form-data` when files
are present). The handler receives a `LoginForm` instance — pyright sees the
inner type directly. TS client sends `URLSearchParams`.

### Multipart files — `UploadFile` + `File()`

```python
from tythe.params import File, UploadFile

@app.post("/avatar")
async def upload(file: Annotated[UploadFile, File()]) -> dict[str, int]: ...
```

## Response control

`Context` is a per-request handle the runtime injects when you annotate a
parameter `ctx: Context`. Mutating these from inside the handler shapes the
final response.

```python
from tythe import Context

@app.post("/issues")
async def create_issue(data: CreateIssue, ctx: Context) -> Issue:
    issue = save(data)
    ctx.set_status(201)
    ctx.set_header("location", f"/issues/{issue.id}")
    ctx.set_cookie(
        "session", sign(user.id),
        max_age=86400, http_only=True, secure=True, same_site="strict",
    )
    return issue
```

| Method                                                                                       | What it does                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ctx.set_status(code)`                                                                       | Override the default 200 (e.g. 201 Created, 202 Accepted).                            |
| `ctx.set_header(name, val)`                                                                  | Add or replace a response header (`Location`, `X-Request-Id`, …).                     |
| `ctx.set_cookie(name, val, *, max_age, expires, path, domain, secure, http_only, same_site)` | Queue a `Set-Cookie` header. Multiple calls = multiple cookies.                       |
| `ctx.after(fn, *a, **kw)`                                                                    | Run `fn` after the response is sent. See [Post-response hooks](#post-response-hooks). |
| `ctx.request`                                                                                | The raw Starlette `Request` if you need an escape hatch.                              |
| `ctx.headers`                                                                                | Read-only dict of request headers.                                                    |
| `ctx.cookies`                                                                                | Read-only dict of request cookies.                                                    |
| `await ctx.is_disconnected()`                                                                | Client-gone check (use it inside long-running streams).                               |

## Typed errors

Declare which exceptions a handler can raise. They become a discriminated union
on the TS side, with `result.ok` narrowing.

```python
from dataclasses import dataclass
from tythe import raises

@dataclass
class IssueNotFound(Exception):
    issue_id: int

@dataclass
class Forbidden(Exception):
    reason: str

@app.get("/issues/{issue_id}")
@raises(IssueNotFound, Forbidden)
async def get_issue(issue_id: int) -> Issue:
    issue = store.get(issue_id)
    if issue is None:
        raise IssueNotFound(issue_id=issue_id)
    return issue
```

TS side:

```ts
const r = await api.getIssue({ issueId: 1 });
if (r.ok) return r.data; // r.data: Issue
switch (
  r.error.kind // exhaustive
) {
  case "IssueNotFound":
    return `× ${r.error.issueId}`;
  case "Forbidden":
    return `× ${r.error.reason}`;
}
```

## Streaming

```python
import asyncio
from tythe import stream

class Tick(msgspec.Struct, tag_field="kind", tag="tick"):
    seq: int

class Done(msgspec.Struct, tag_field="kind", tag="done"):
    total: int

@app.get("/ticks")
async def ticks(count: int) -> stream[Tick | Done]:
    for i in range(count):
        await asyncio.sleep(0.5)
        yield Tick(seq=i)
    yield Done(total=count)
```

Wire is SSE (`text/event-stream`). TS client returns an `AsyncIterable`:

```ts
for await (const ev of api.ticks({ count: 10 }, { signal: ac.signal })) {
  if (ev.kind === "tick") console.log(ev.seq);
}
```

Streams + `@raises(...)`: declared errors surface as SSE `event: error`
frames that throw on the client side.

## Dependency injection

```python
from tythe import Depends

def current_user(authorization: Annotated[str, Header()] = "") -> User:
    if not authorization.startswith("Bearer "):
        raise Forbidden(reason="missing token")
    return decode(authorization[7:])

@app.get("/me")
async def me(me: User = Depends(current_user)) -> User:
    return me
```

Providers can be plain functions, async functions, sync generators yielding
once, or async generators yielding once. The post-`yield` body runs as
teardown after the response is finalized. Same shape as FastAPI.

## Post-response hooks

```python
from tythe import after

@app.post("/posts")
async def create_post(data: CreatePost) -> Post:
    post = save(data)
    after(notify_webhook, post.id)
    after(log_audit, "post.created", user_id=post.author_id)
    return post
```

Runs sync and async callables after the response is sent. Errors are
swallowed (response is already gone). Looked up via a contextvar — works
without threading `ctx` through. Outside a handler it raises.

Also available as `ctx.after(fn, …)` if you have `Context` in scope.

## Background jobs

In-memory queue ships in core. Redis / SQS adapters live in their own
packages.

```python
from tythe import InMemoryBackend, TaskBackend, TaskState

backend: TaskBackend = InMemoryBackend()

async def heavy_work(arg: int) -> str:
    await asyncio.sleep(10)
    return f"done({arg})"

@app.post("/work")
async def submit() -> dict[str, str]:
    task_id = await backend.enqueue(heavy_work, 42)
    return {"task_id": task_id}

@app.get("/work/{task_id}")
async def status(task_id: str) -> TaskState[str]:
    return await backend.status(task_id)
```

`InMemoryBackend.stream(task_id)` yields `TaskState` snapshots through the
queued → running → succeeded/failed/cancelled lifecycle.

## Observability

```python
from tythe import App
from tythe.otel import instrument

app = instrument(App())
```

Adds one OpenTelemetry span per request with method, path, and status code.
No-op if `opentelemetry-api` isn't installed (it's an optional extra:
`tythe[otel]`).

## OpenAPI + polyglot codegen

CLI commands that read the same IR the TS codegen uses:

```bash
tythe openapi server.app:app --out openapi.json
tythe swift server.app:app --out Tythe.swift
tythe kotlin server.app:app --out Tythe.kt --package com.example.api
```

- **`tythe openapi`** — OpenAPI 3.1 doc for external clients (consumers
  who can't use Tythe's TS client).
- **`tythe swift`** — typed Swift client using URLSession + JSONEncoder
  with `convertToSnakeCase`.
- **`tythe kotlin`** — typed Kotlin client using HttpURLConnection +
  `kotlinx.serialization` (no ktor/OkHttp dep).

Streaming endpoints surface as `URLRequest` (Swift) / raw `String` (Kotlin) —
caller wires SSE through their platform's preferred parser.

## What's NOT here

By design. See [`docs/design.md`](./design.md) for the reasoning.

- No `tythe.ai` / LLM-shaped types — LLM tokens are just typed events on
  an SSE stream; use the existing `stream[T]` primitive.
- No auth implementation — wire `Depends(current_user)` to your provider
  (Clerk / Auth0 / custom JWT). See [`docs/auth.md`](./auth.md).
- No rate limiting, caching headers, ETag — single-header concerns that
  middleware or `set_header` cover.
- No WebSocket bidi (yet) — SSE is the default, opt-in only.
- No GraphQL.
