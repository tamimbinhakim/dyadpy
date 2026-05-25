"""Owned development server with in-process hot swapping."""

from __future__ import annotations

import asyncio
import contextlib
import importlib
import sys
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import uvicorn
from rich.console import Console
from watchfiles import awatch

from dyadpy.app import App
from dyadpy.codegen import write as write_client
from dyadpy.ir import build_ir

Scope = dict[str, Any]
Message = dict[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
Builder = Callable[[Sequence[Path]], "DevSnapshot"]
Classifier = Callable[[Sequence[Path]], "ChangeDecision"]

_EXCLUDE_MODULE_PREFIXES = (
    "dyadpy",
    "causeway",
    "uvicorn",
    "starlette",
    "watchfiles",
    "rich",
    "typer",
)


@dataclass(frozen=True, slots=True)
class RouteInfo:
    method: str
    path: str
    source: str | None = None

    @property
    def key(self) -> tuple[str, str]:
        return (self.method, self.path)


@dataclass(slots=True)
class DevSnapshot:
    app: Any
    routes: list[RouteInfo] = field(default_factory=list)
    client_out: Path | None = None
    client_written: bool = False

    @property
    def route_count(self) -> int:
        return len(self.routes)


@dataclass(frozen=True, slots=True)
class ChangeDecision:
    reload: bool = True
    reason: str | None = None

    @classmethod
    def restart_required(cls, reason: str) -> ChangeDecision:
        return cls(reload=False, reason=reason)


class HotSwapApp:
    """ASGI wrapper that atomically points new requests at the latest snapshot."""

    def __init__(
        self,
        snapshot: DevSnapshot,
        *,
        reporter: DevReporter | None = None,
    ) -> None:
        self._snapshot = snapshot
        self._lifespan_app = snapshot.app
        self._generation = 1
        self._reporter = reporter

    @property
    def snapshot(self) -> DevSnapshot:
        return self._snapshot

    @property
    def generation(self) -> int:
        return self._generation

    def swap(self, snapshot: DevSnapshot) -> int:
        self._generation += 1
        self._snapshot = snapshot
        return self._generation

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "lifespan":
            await self._lifespan_app(scope, receive, send)
            return

        snapshot = self._snapshot
        started = time.perf_counter()
        status_code: int | None = None

        async def send_with_status(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                raw_status = message.get("status")
                if isinstance(raw_status, int):
                    status_code = raw_status
            await send(message)

        await snapshot.app(scope, receive, send_with_status)

        if scope["type"] == "http" and self._reporter is not None:
            elapsed_ms = (time.perf_counter() - started) * 1000
            self._reporter.access(scope, status_code, elapsed_ms)


class DevReporter:
    def __init__(
        self,
        *,
        name: str,
        host: str,
        port: int,
        target: str,
        console: Console | None = None,
    ) -> None:
        self.name = name
        self.host = host
        self.port = port
        self.target = target
        self.console = console or Console()

    def banner(self, snapshot: DevSnapshot, watch: Path) -> None:
        self.console.print(f"[bold]{self.name} dev[/bold]\n")
        self.console.print(f"  server     http://{self.host}:{self.port}")
        self.console.print(f"  app        {self.target}")
        self.console.print(f"  watch      {watch}")
        self.console.print(f"  routes     {snapshot.route_count}")
        if snapshot.client_out is not None:
            self.console.print(f"  client     {snapshot.client_out}")
        self.console.print("  reload     smart hot-swap\n")

    def changed(self, paths: Sequence[Path]) -> None:
        stamp = _stamp()
        if len(paths) == 1:
            self.console.print(f"[dim]{stamp}[/dim] changed   {_display(paths[0])}")
            return
        self.console.print(f"[dim]{stamp}[/dim] changed   {len(paths)} files")
        for path in paths:
            self.console.print(f"  {_display(path)}")

    def restart_required(self, paths: Sequence[Path], reason: str) -> None:
        stamp = _stamp()
        self.console.print(f"[dim]{stamp}[/dim] [yellow]restart required[/yellow]")
        for path in paths:
            self.console.print(f"  {_display(path)}")
        self.console.print(f"reason: {reason}")

    def reload_ok(
        self,
        *,
        generation: int,
        old: DevSnapshot,
        new: DevSnapshot,
        elapsed_ms: float,
    ) -> None:
        stamp = _stamp()
        self.console.print(
            f"[dim]{stamp}[/dim] [green]reload ok[/green] "
            f"{elapsed_ms:.0f}ms  generation={generation}  routes={new.route_count}",
        )
        self._route_diff(old.routes, new.routes)
        if new.client_written and new.client_out is not None:
            self.console.print(f"  client updated  {_display(new.client_out)}")

    def reload_failed(self, exc: BaseException) -> None:
        from dyadpy._traceback import format_exception

        stamp = _stamp()
        self.console.print(f"[dim]{stamp}[/dim] [red]reload failed[/red] - serving previous app")
        self.console.print(format_exception(exc))

    def access(self, scope: Scope, status_code: int | None, elapsed_ms: float) -> None:
        method = str(scope.get("method", "?"))
        path = str(scope.get("path", "?"))
        status = status_code if status_code is not None else "-"
        color = "green" if isinstance(status, int) and status < 400 else "red"
        self.console.print(
            f"[dim]{_stamp()}[/dim] {method:<6} {path:<32} [{color}]{status}[/{color}] "
            f"{elapsed_ms:.0f}ms",
        )

    def _route_diff(self, old: list[RouteInfo], new: list[RouteInfo]) -> None:
        old_by_key = {r.key: r for r in old}
        new_by_key = {r.key: r for r in new}
        added = [new_by_key[k] for k in sorted(new_by_key.keys() - old_by_key.keys())]
        removed = [old_by_key[k] for k in sorted(old_by_key.keys() - new_by_key.keys())]
        changed = [
            new_by_key[k]
            for k in sorted(new_by_key.keys() & old_by_key.keys())
            if new_by_key[k].source != old_by_key[k].source
        ]
        for route in added:
            self.console.print(f"  + {route.method:<6} {route.path:<32} {route.source or ''}")
        for route in changed:
            self.console.print(f"  ~ {route.method:<6} {route.path:<32} {route.source or ''}")
        for route in removed:
            self.console.print(f"  - {route.method:<6} {route.path:<32} {route.source or ''}")


class SmartDevServer:
    def __init__(
        self,
        *,
        builder: Builder,
        reporter: DevReporter,
        watch: Path,
        host: str,
        port: int,
        classifier: Classifier | None = None,
        watch_filter: Callable[[object, str], bool] | None = None,
    ) -> None:
        self.builder = builder
        self.reporter = reporter
        self.watch = watch
        self.host = host
        self.port = port
        self.classifier = classifier or (lambda _paths: ChangeDecision())
        self.watch_filter = watch_filter or _py_only

    async def run(self) -> None:
        snapshot = self.builder(())
        hotswap = HotSwapApp(snapshot, reporter=self.reporter)
        self.reporter.banner(snapshot, self.watch)

        config = uvicorn.Config(
            hotswap,
            host=self.host,
            port=self.port,
            reload=False,
            access_log=False,
        )
        server = uvicorn.Server(config)
        watch_task = asyncio.create_task(self._watch_loop(hotswap))
        try:
            await server.serve()
        finally:
            watch_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await watch_task

    async def _watch_loop(self, hotswap: HotSwapApp) -> None:
        async for changes in awatch(
            self.watch,
            recursive=True,
            watch_filter=self.watch_filter,
            debounce=100,
        ):
            paths = sorted({Path(path).resolve() for _, path in changes})
            if not paths:
                continue
            self.reporter.changed(paths)
            decision = self.classifier(paths)
            if not decision.reload:
                self.reporter.restart_required(paths, decision.reason or "unsafe change")
                continue

            started = time.perf_counter()
            old = hotswap.snapshot
            try:
                new = self.builder(paths)
            except Exception as exc:
                self.reporter.reload_failed(exc)
                continue
            generation = hotswap.swap(new)
            elapsed_ms = (time.perf_counter() - started) * 1000
            self.reporter.reload_ok(
                generation=generation,
                old=old,
                new=new,
                elapsed_ms=elapsed_ms,
            )


def dyadpy_snapshot_builder(
    *,
    target: str,
    out: Path,
    watch: Path,
) -> Builder:
    def build(changed: Sequence[Path]) -> DevSnapshot:
        if changed:
            evict_modules_under(watch)
        app = load_app(target)
        ir = build_ir(app)
        write_client(ir, out)
        return DevSnapshot(
            app=app,
            routes=routes_from_dyadpy_app(app),
            client_out=out,
            client_written=True,
        )

    return build


def load_app(target: str) -> App:
    module_name, _, attr = target.partition(":")
    if not module_name or not attr:
        msg = "Target must be 'module:attr', e.g. 'server.app:app'."
        raise ValueError(msg)
    importlib.invalidate_caches()
    module = importlib.import_module(module_name)
    obj = getattr(module, attr)
    if not isinstance(obj, App):
        msg = f"{target} is not a dyadpy.App instance."
        raise TypeError(msg)
    return obj


def routes_from_dyadpy_app(app: App) -> list[RouteInfo]:
    return [
        RouteInfo(method=route.method, path=route.path, source=_handler_source(route.handler))
        for route in app.routes
    ]


def evict_modules_under(root: Path) -> list[str]:
    resolved_root = root.resolve()
    evicted: list[str] = []
    for name, module in list(sys.modules.items()):
        if name.startswith(_EXCLUDE_MODULE_PREFIXES):
            continue
        file = getattr(module, "__file__", None)
        if not isinstance(file, str):
            continue
        try:
            path = Path(file).resolve()
            path.relative_to(resolved_root)
        except (OSError, ValueError):
            continue
        sys.modules.pop(name, None)
        evicted.append(name)
    importlib.invalidate_caches()
    return evicted


def evict_module_name(module_name: str) -> None:
    sys.modules.pop(module_name, None)
    importlib.invalidate_caches()


def _handler_source(handler: Callable[..., Any]) -> str | None:
    code = getattr(handler, "__code__", None)
    if code is None:
        return None
    return _display(Path(code.co_filename))


def _display(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(Path.cwd()))
    except ValueError:
        return str(path)


def _stamp() -> str:
    return time.strftime("%H:%M:%S")


def _py_only(_change: object, path: str) -> bool:
    return path.endswith(".py")


def run_dyadpy_dev(
    *,
    target: str,
    host: str,
    port: int,
    out: Path,
    watch: Path,
) -> None:
    reporter = DevReporter(name="Dyadpy", host=host, port=port, target=target)
    server = SmartDevServer(
        builder=dyadpy_snapshot_builder(target=target, out=out, watch=watch),
        reporter=reporter,
        watch=watch,
        host=host,
        port=port,
    )
    asyncio.run(server.run())


__all__ = [
    "ChangeDecision",
    "DevReporter",
    "DevSnapshot",
    "HotSwapApp",
    "RouteInfo",
    "SmartDevServer",
    "dyadpy_snapshot_builder",
    "evict_module_name",
    "evict_modules_under",
    "load_app",
    "routes_from_dyadpy_app",
    "run_dyadpy_dev",
]
