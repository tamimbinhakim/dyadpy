# Examples

Runnable starter projects. Each one is self-contained — `cd` in, install,
run, poke around.

| Example                                    | Stack                                  | What it shows                                                                                                                                        |
| ------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`nextjs-streaming`](./nextjs-streaming)   | Next.js 15 (App Router) + Python `App` | Typed SSE streaming — progress, logs, and a final result — with discriminated-union narrowing and cancellation. The hero demo.                       |
| [`vite-react`](./vite-react)               | Vite + React + Python `App`            | Issue tracker. Typed errors, exhaustive switches, enum value-objects, the `Routes.X.*` namespace, and a side-by-side **vs FastAPI** comparison page. |
| [`sveltekit-counter`](./sveltekit-counter) | SvelteKit 2 + Svelte 5 + Python `App`  | Counter with typed `@raises` errors and a live subscription store backed by SSE. Demos `@dyadpy/svelte`.                                             |

> These examples are **not** published to npm or PyPI. They exist to demo
> features and catch regressions in real-world setups. Copy/paste from them
> freely.

## How they're wired

Each example has two halves:

```
examples/<name>/
├── server/                  # Python — runs uvicorn via `dyadpy dev`
│   ├── app.py
│   └── pyproject.toml
└── frontend/                # Whatever JS framework — runs its own dev server
    ├── src/
    │   └── lib/dyadpy/
    │       └── client.ts    # Generated. Don't edit.
    ├── package.json
    └── ...
```

Run the server with the watcher, run the frontend separately, profit.

## What's intentionally missing

- **Auth.** Sample recipes (Clerk / NextAuth / custom JWT) live in
  [`docs/auth.md`](../docs/auth.md). Examples themselves assume single-user.
- **Persistence.** In-memory `dict[int, Issue]` is enough to show the wire
  protocol. Bring your own DB.
- **Deployment configs.** No Dockerfiles, no `vercel.json`. Examples are
  local-dev only; deployment is intentionally out of scope.
