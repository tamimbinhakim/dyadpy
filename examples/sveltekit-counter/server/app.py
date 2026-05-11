"""SvelteKit counter — minimal Tythe + Svelte 5 + TanStack-free stores demo."""

# pyright: basic

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import msgspec

from tythe import App, raises, stream

app = App()


class Counter(msgspec.Struct):
    value: int


class Increment(msgspec.Struct):
    by: int = 1


@dataclass
class OutOfRange(Exception):
    value: int
    max: int


_state = {"value": 0}
_MAX = 100


@app.get("/counter")
async def get_counter() -> Counter:
    return Counter(value=_state["value"])


@app.post("/counter/increment")
@raises(OutOfRange)
async def increment(data: Increment) -> Counter:
    new = _state["value"] + data.by
    if new > _MAX:
        raise OutOfRange(value=new, max=_MAX)
    _state["value"] = new
    return Counter(value=new)


@app.get("/counter/stream")
async def stream_counter() -> stream[Counter]:
    """Tick the current counter every 500ms — demos the subscription store."""
    while True:
        yield Counter(value=_state["value"])
        await asyncio.sleep(0.5)
