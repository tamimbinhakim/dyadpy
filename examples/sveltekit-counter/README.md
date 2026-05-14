# SvelteKit counter example

A minimal end-to-end Dyadpy demo using `@dyadpy/svelte`:

- A typed `Counter` shared between Python and Svelte
- A `@raises(OutOfRange)` mutation that surfaces as a typed `.error` on the store
- A `stream[Counter]` SSE endpoint consumed by the subscription store

## Run

In one terminal:

```bash
cd server
uv sync
uv run dyadpy dev app:app --out ../frontend/src/lib/dyadpy/client.ts
```

In another:

```bash
cd frontend
pnpm install
pnpm dev
```

Open <http://localhost:5173>. Click increment a hundred times to see the
typed error surface.

## What's interesting

- Single source of truth: `Counter`, `Increment`, `OutOfRange` are declared
  once in `server/app.py`; the typed TS shapes show up in `client.ts`.
- The subscription store demos SSE — the live value ticks every 500ms
  without you writing a websocket or hand-parsing event frames.
