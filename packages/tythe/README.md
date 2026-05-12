# tythe (Python)

> A type-safe RPC bridge between Python and TypeScript.

```bash
uv add tythe
```

This is the Python half of [Tythe](https://github.com/tamimbinhakim/tythe). It
ships:

- A thin ASGI framework (`tythe.App`) that uses your function signatures
  as the contract — no separate Pydantic models declared above the
  handler.
- A type extractor that walks `inspect.signature` +
  `typing.get_type_hints`, normalizes through `msgspec`'s native JSON
  Schema export, and produces a canonical IR.
- A codegen that turns the IR into a single `client.ts` for your
  frontend.
- A CLI (`tythe dev`, `tythe build`, `tythe codegen`, `tythe init`) that
  runs the whole loop in one process.

For the full story, the design rationale, and a side-by-side comparison
vs. FastAPI + openapi-typescript / tRPC / Encore.ts / Connect-RPC, see
the [repo README](https://github.com/tamimbinhakim/tythe).

## 30-second example

```python
from tythe import App, stream, raises
from dataclasses import dataclass
import msgspec

app = App()

class CreatePost(msgspec.Struct):
    title: str
    body: str

class Post(msgspec.Struct):
    id: int
    title: str
    body: str

@dataclass
class PostNotFound(Exception):
    post_id: int

@app.post("/posts")
async def create_post(data: CreatePost) -> Post: ...

@app.get("/posts/{post_id}")
@raises(PostNotFound)
async def get_post(post_id: int) -> Post: ...

class Tick(msgspec.Struct, tag="tick"):
    seq: int

@app.get("/ticks")
async def ticks(count: int) -> stream[Tick]:
    for i in range(count):
        yield Tick(seq=i)
```

Run it:

```bash
tythe dev server.app:app
```

The watcher writes `frontend/src/lib/tythe/client.ts` automatically. Then
in your frontend:

```ts
import { api } from "@/lib/tythe/client";

const post = await api.createPost({ data: { title: "hi", body: "world" } });

for await (const ev of api.ticks({ count: 10 })) {
  /* typed */
}
```

## Primitives in this package

| Primitive                                                           | Purpose                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `App` + `@app.{get,post,put,patch,delete}`                          | Route decorators.                                           |
| `Annotated[T, Body / Query / Path / Header / Cookie / File / Form]` | Parameter location markers.                                 |
| `Annotated[list[T], Query()]`                                       | Repeated query params (`?tag=a&tag=b`).                     |
| `Bytes`                                                             | Raw request / response bodies. Skips the JSON envelope.     |
| `stream[T]`                                                         | Typed SSE — client gets `AsyncIterable<T>`.                 |
| `@raises(E1, E2, …)`                                                | Typed error union → `Result<T, E1 \| E2>` on the TS side.   |
| `Context.set_status / set_header / set_cookie / after`              | Shape the response without dropping to Starlette.           |
| `Depends(provider)`                                                 | DI in the FastAPI shape.                                    |
| `after(fn, …)`                                                      | Run a callback after the response is sent.                  |
| `InMemoryBackend` + `TaskBackend` Protocol                          | Background jobs.                                            |
| `tythe.otel.instrument(app)`                                        | One OpenTelemetry span per request (`tythe[otel]`).         |
| `tythe openapi / swift / kotlin` (CLI)                              | Emit OpenAPI 3.1, Swift, or Kotlin clients off the same IR. |

Full reference: <https://github.com/tamimbinhakim/tythe/blob/main/docs/reference.md>

## Optional extras

```bash
uv add 'tythe[pydantic]'  # Pydantic plugin (model_validate + model_json_schema)
uv add 'tythe[otel]'      # OpenTelemetry middleware
uv add 'tythe[all]'       # everything
```

## Scope

Tythe ships at the wire level: RPC, typed streaming, typed errors,
cancellation, file uploads, dependency injection. It does **not** ship
vertical integrations — no LLM types, no React hooks in core, no
chat-bot primitives. Those layers compose on top of the fundamentals
and live in their own packages.

## License

MIT
