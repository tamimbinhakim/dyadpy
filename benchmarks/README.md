# Benchmarks — Tythe vs FastAPI vs Litestar

Identical handlers across all three frameworks, served by the same uvicorn
build, driven by an in-process asyncio + httpx load generator. The goal is
to measure framework overhead in isolation — there is no database, no
external I/O, and no application logic beyond echoing the inputs.

## What we measure

- **Cold start.** Wall-clock from process spawn to the first `200 OK` on
  `GET /healthz`. Captures import time + ASGI app build.
- **Steady-state throughput** and **p50 / p95 / p99 latency** under a fixed
  concurrency for a fixed wall-clock duration. The first warmup request per
  worker is dropped to avoid JIT / connection-pool noise.

## Scenarios

All three apps expose the same four routes:

| Route             | Shape                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| `GET /healthz`    | `{"ok": true}` — trivial, isolates framework overhead.                  |
| `GET /users/{id}` | typed `int` path param → small response. Hits path-param validation.    |
| `POST /echo`      | typed body `{"text": str}` → echoes it. Hits request validation + JSON. |
| `GET /list`       | 50-element array. Hits response serialization.                          |

The Tythe handler set is in [`apps/tythe_app.py`](apps/tythe_app.py); the
FastAPI and Litestar peers live alongside it and produce byte-identical
wire output.

## Running it

```bash
cd benchmarks
uv sync                       # one-time
uv run bench.py               # full matrix (default 10s, concurrency 64)
uv run bench.py --duration 5  # quick smoke
uv run bench.py --frameworks tythe fastapi
```

Each run writes a timestamped directory under `results/`:

```
results/20XX-MM-DDTHHMMSSZ/
  results.json   # raw numbers
  report.md      # readable summary
```

`results/` is gitignored — these are local artifacts.

## Methodology notes (read before quoting numbers)

- **Single uvicorn worker per framework.** Concurrency lives on the client
  side. Multi-worker numbers are a separate question.
- **Loopback.** Client and server share the box. At high concurrency this
  becomes the bottleneck — the absolute throughput numbers are not portable
  to network conditions. Cold-start numbers and relative ordering generally
  are.
- **Same Python interpreter, same machine, same run.** Cross-machine
  comparisons require running on dedicated hardware with the load generator
  on a separate host.
- **No access logs, no docs route, no middleware.** Each app is configured
  with the most minimal version of itself we can produce while still being
  idiomatic.

## A representative result

Most recent local run (10s / scenario, concurrency 64, on the development
machine — your numbers will differ):

| Framework | Cold start |
| --------- | ---------: |
| tythe     |     109 ms |
| fastapi   |     222 ms |
| litestar  |     265 ms |

Throughput sits within 10–25% across all three frameworks at this
concurrency level — at this load profile the loopback round-trip dominates,
not framework overhead. We publish the full report after each run; the
release artifact uses numbers measured on dedicated CI hardware.

## Why these three

- **FastAPI** is the dominant Python web framework today.
- **Litestar** is the closest peer to Tythe in design — msgspec-first,
  ASGI-native, performance-oriented.
- **Tythe** is the subject under test.

Numbers measured against Flask / Django / aiohttp are interesting but
belong in a different report; those frameworks make different trade-offs
and the comparison would be apples to oranges.
