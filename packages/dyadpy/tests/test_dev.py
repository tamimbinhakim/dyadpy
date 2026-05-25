"""Smart dev server primitives."""

# pyright: basic

from __future__ import annotations

import io

import httpx
from rich.console import Console

from dyadpy.dev import DevReporter, DevSnapshot, HotSwapApp


def _asgi_text(body: str):
    async def app(scope, receive, send) -> None:
        del receive
        if scope["type"] == "lifespan":
            await send({"type": "lifespan.startup.complete"})
            await send({"type": "lifespan.shutdown.complete"})
            return
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"text/plain")],
            },
        )
        await send({"type": "http.response.body", "body": body.encode()})

    return app


async def test_hotswap_app_serves_new_snapshot_without_restarting() -> None:
    output = io.StringIO()
    reporter = DevReporter(
        name="Dyadpy",
        host="127.0.0.1",
        port=8000,
        target="demo.app:app",
        console=Console(file=output, force_terminal=False),
    )
    app = HotSwapApp(DevSnapshot(app=_asgi_text("one")), reporter=reporter)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        first = await client.get("/")
        generation = app.swap(DevSnapshot(app=_asgi_text("two")))
        second = await client.get("/")

    assert generation == 2
    assert first.text == "one"
    assert second.text == "two"
    assert "GET" in output.getvalue()
