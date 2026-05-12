"""Run identical scenarios against Tythe / FastAPI / Litestar and report numbers.

Each framework gets its own uvicorn subprocess so the ASGI server is held
constant. The driver measures cold-start (time from process spawn to first
200), then runs a configurable number of concurrent workers issuing requests
for a fixed wall-clock duration. Per-request latencies are collected in-process
and aggregated to p50 / p95 / p99 + throughput.

Usage::

    uv run bench.py                # full matrix, default duration
    uv run bench.py --duration 5   # quick smoke
    uv run bench.py --frameworks tythe fastapi   # subset

Results land in ``results/<timestamp>/`` as JSON + a Markdown summary.
"""

# pyright: basic

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import socket
import statistics
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parent
APPS = ROOT / "apps"
RESULTS = ROOT / "results"


@dataclass(slots=True)
class Framework:
    name: str
    module: str  # uvicorn target, e.g. "tythe_app:app"


FRAMEWORKS: list[Framework] = [
    Framework(name="tythe", module="tythe_app:app"),
    Framework(name="fastapi", module="fastapi_app:app"),
    Framework(name="litestar", module="litestar_app:app"),
]


@dataclass(slots=True)
class Scenario:
    name: str
    method: str
    path: str
    body: dict[str, Any] | None = None


SCENARIOS: list[Scenario] = [
    Scenario(name="healthz", method="GET", path="/healthz"),
    Scenario(name="path_param", method="GET", path="/users/42"),
    Scenario(name="json_echo", method="POST", path="/echo", body={"text": "hello world"}),
    Scenario(name="list_50", method="GET", path="/list"),
]


@dataclass(slots=True)
class ScenarioResult:
    scenario: str
    requests: int
    errors: int
    duration_s: float
    rps: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    mean_ms: float
    max_ms: float


@dataclass(slots=True)
class FrameworkResult:
    framework: str
    cold_start_ms: float
    scenarios: list[ScenarioResult] = field(default_factory=list)


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def _wait_ready(url: str, timeout: float = 30.0) -> float:
    """Poll the health endpoint; return ms-elapsed at first 200."""
    start = time.perf_counter()
    deadline = start + timeout
    async with httpx.AsyncClient(timeout=1.0) as client:
        while time.perf_counter() < deadline:
            with contextlib.suppress(httpx.HTTPError, httpx.RequestError):
                r = await client.get(url)
                if r.status_code == 200:
                    return (time.perf_counter() - start) * 1000
            await asyncio.sleep(0.02)
    raise TimeoutError(f"app at {url} never became ready within {timeout}s")


def _venv_uvicorn() -> Path:
    """Resolve the uvicorn entry point in the benchmarks' own .venv.

    Avoids ``uv run``'s bootstrap latency, which would otherwise dominate
    cold-start numbers and make them meaningless.
    """
    candidate = ROOT / ".venv" / "bin" / "uvicorn"
    if candidate.exists():
        return candidate
    msg = (
        f"uvicorn not found at {candidate} — run `uv sync` in benchmarks/ first."
    )
    raise FileNotFoundError(msg)


def _spawn(module: str, port: int) -> subprocess.Popen[bytes]:
    cmd = [
        str(_venv_uvicorn()),
        module,
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--log-level",
        "warning",
        "--no-access-log",
    ]
    return subprocess.Popen(
        cmd,
        cwd=APPS,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


async def _worker(
    client: httpx.AsyncClient,
    scenario: Scenario,
    base_url: str,
    end_at: float,
    samples: list[float],
    errors: list[int],
) -> None:
    url = base_url + scenario.path
    body = scenario.body
    while time.monotonic() < end_at:
        t0 = time.perf_counter()
        try:
            if scenario.method == "GET":
                resp = await client.get(url)
            else:
                resp = await client.post(url, json=body)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            if resp.status_code >= 400:
                errors[0] += 1
            else:
                samples.append(elapsed_ms)
        except httpx.HTTPError:
            errors[0] += 1


async def _run_scenario(
    scenario: Scenario,
    base_url: str,
    *,
    concurrency: int,
    duration_s: float,
) -> ScenarioResult:
    # Warmup — drop the first second of samples to avoid JIT / connection-pool noise.
    samples: list[float] = []
    errors = [0]
    end_at = time.monotonic() + duration_s

    limits = httpx.Limits(max_connections=concurrency * 2, max_keepalive_connections=concurrency)
    async with httpx.AsyncClient(timeout=10.0, limits=limits) as client:
        # Single warmup hit per worker, ignored from stats.
        for _ in range(concurrency):
            with contextlib.suppress(httpx.HTTPError):
                if scenario.method == "GET":
                    await client.get(base_url + scenario.path)
                else:
                    await client.post(base_url + scenario.path, json=scenario.body)
        workers = [
            asyncio.create_task(
                _worker(client, scenario, base_url, end_at, samples, errors),
            )
            for _ in range(concurrency)
        ]
        await asyncio.gather(*workers)

    actual_duration = duration_s
    requests = len(samples)
    if not samples:
        return ScenarioResult(
            scenario=scenario.name,
            requests=0,
            errors=errors[0],
            duration_s=actual_duration,
            rps=0.0,
            p50_ms=0.0,
            p95_ms=0.0,
            p99_ms=0.0,
            mean_ms=0.0,
            max_ms=0.0,
        )
    samples_sorted = sorted(samples)

    def _pct(p: float) -> float:
        idx = min(len(samples_sorted) - 1, int(round(p * len(samples_sorted))))
        return samples_sorted[idx]

    return ScenarioResult(
        scenario=scenario.name,
        requests=requests,
        errors=errors[0],
        duration_s=actual_duration,
        rps=requests / actual_duration,
        p50_ms=_pct(0.50),
        p95_ms=_pct(0.95),
        p99_ms=_pct(0.99),
        mean_ms=statistics.fmean(samples_sorted),
        max_ms=samples_sorted[-1],
    )


async def _benchmark_one(
    fw: Framework, *, duration_s: float, concurrency: int
) -> FrameworkResult:
    port = _free_port()
    base_url = f"http://127.0.0.1:{port}"
    proc = _spawn(fw.module, port)
    try:
        cold_ms = await _wait_ready(f"{base_url}/healthz")
        scenarios: list[ScenarioResult] = []
        for scenario in SCENARIOS:
            print(f"  {fw.name}/{scenario.name} … ", end="", flush=True)
            result = await _run_scenario(
                scenario,
                base_url,
                concurrency=concurrency,
                duration_s=duration_s,
            )
            print(f"{result.rps:>9.0f} rps   p50={result.p50_ms:.2f}ms   p99={result.p99_ms:.2f}ms")
            scenarios.append(result)
        return FrameworkResult(framework=fw.name, cold_start_ms=cold_ms, scenarios=scenarios)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def _markdown_report(results: list[FrameworkResult]) -> str:
    lines: list[str] = []
    lines.append("# Tythe benchmark — vs FastAPI + Litestar")
    lines.append("")
    lines.append("Identical handlers across all three frameworks, served by uvicorn,")
    lines.append("driven by an in-process asyncio + httpx client. Numbers measure")
    lines.append("framework overhead — no database, no I/O outside the framework.")
    lines.append("")
    lines.append("## Cold start (process spawn → first 200 on /healthz)")
    lines.append("")
    lines.append("| Framework | Cold start |")
    lines.append("|-----------|-----------:|")
    for r in results:
        lines.append(f"| {r.framework} | {r.cold_start_ms:.0f} ms |")
    lines.append("")
    for scenario in SCENARIOS:
        lines.append(f"## Scenario `{scenario.name}` — `{scenario.method} {scenario.path}`")
        lines.append("")
        lines.append("| Framework | req/s | p50 (ms) | p95 (ms) | p99 (ms) | mean (ms) | errors |")
        lines.append("|-----------|------:|---------:|---------:|---------:|----------:|-------:|")
        for r in results:
            s = next((x for x in r.scenarios if x.scenario == scenario.name), None)
            if s is None:
                continue
            lines.append(
                f"| {r.framework} | {s.rps:.0f} | {s.p50_ms:.2f} | "
                f"{s.p95_ms:.2f} | {s.p99_ms:.2f} | {s.mean_ms:.2f} | {s.errors} |"
            )
        lines.append("")
    lines.append("## Methodology")
    lines.append("")
    lines.append("- Single uvicorn worker per framework (concurrency comes from the client).")
    lines.append("- One warmup request per concurrent worker, dropped from stats.")
    lines.append("- Each scenario runs for the duration printed above; latencies are")
    lines.append("  collected per-request and the percentiles are computed offline.")
    lines.append("- Same Python interpreter, same machine, same loopback. Numbers are")
    lines.append("  comparable to each other on this run, not absolute across machines.")
    lines.append("")
    return "\n".join(lines)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--duration", type=float, default=10.0, help="seconds per scenario")
    parser.add_argument("--concurrency", type=int, default=64)
    parser.add_argument("--frameworks", nargs="*", default=None, help="subset of frameworks to run")
    args = parser.parse_args()

    selected: list[Framework]
    if args.frameworks:
        wanted = set(args.frameworks)
        selected = [f for f in FRAMEWORKS if f.name in wanted]
        if not selected:
            print(f"no frameworks matched {args.frameworks!r}", file=sys.stderr)
            sys.exit(2)
    else:
        selected = FRAMEWORKS

    stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    outdir = RESULTS / stamp
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"# tythe benchmarks — duration={args.duration}s, concurrency={args.concurrency}")
    print(f"# output: {outdir.relative_to(ROOT)}/")
    print()

    results: list[FrameworkResult] = []
    for fw in selected:
        print(f"==> {fw.name}")
        result = await _benchmark_one(
            fw, duration_s=args.duration, concurrency=args.concurrency
        )
        results.append(result)
        print(f"    cold start: {result.cold_start_ms:.0f} ms")
        print()

    raw_json = {
        "duration_s": args.duration,
        "concurrency": args.concurrency,
        "started_at": stamp,
        "frameworks": [asdict(r) for r in results],
    }
    (outdir / "results.json").write_text(json.dumps(raw_json, indent=2))
    (outdir / "report.md").write_text(_markdown_report(results))
    print(f"wrote {outdir / 'results.json'}")
    print(f"wrote {outdir / 'report.md'}")


if __name__ == "__main__":
    asyncio.run(main())
