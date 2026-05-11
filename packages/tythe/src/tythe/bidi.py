"""WebSocket bidirectional channel: ``bidi[Send, Recv]``.

A handler annotated ``-> bidi[Send, Recv]`` becomes a WebSocket endpoint
whose codegen surface is symmetric: the client sends tagged ``Send``
events and receives ``Recv`` events back, both as discriminated unions.

The transport is opt-in. SSE remains the default streaming primitive
(per ``docs/design.md``). Reach for ``bidi`` only when you genuinely
need client→server pushes — e.g. live cursors, voice agents, multi-user
editing.

Wire shape: JSON frames over a single WebSocket. Same tagged-union
conventions msgspec already uses, no separate envelope.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Generic, TypeVar, get_args, get_origin

import msgspec
from starlette.websockets import WebSocket

S = TypeVar("S")
R = TypeVar("R")


class BidiChannel(Generic[S, R]):
    """Handler-side view of a WebSocket channel.

    Use ``async for ev in channel`` to receive client messages of type ``R``,
    and ``await channel.send(value)`` to push a server message of type ``S``.
    """

    def __init__(self, ws: WebSocket, send_type: Any, recv_type: Any) -> None:
        self._ws = ws
        self._send_type = send_type
        self._recv_type = recv_type
        self._encoder = msgspec.json.Encoder()

    async def send(self, value: S) -> None:
        await self._ws.send_bytes(self._encoder.encode(value))

    async def __aiter__(self) -> AsyncIterator[R]:
        while True:
            raw = await self._ws.receive_text()
            yield msgspec.json.decode(raw.encode(), type=self._recv_type)

    async def close(self, code: int = 1000) -> None:
        await self._ws.close(code=code)


# Parameterized alias so handlers can write ``-> bidi[ClientMsg, ServerMsg]``.
# At runtime ``bidi[S, R]`` is just ``BidiChannel[S, R]`` — the codegen reads
# the type args off the annotation.
bidi = BidiChannel


def is_bidi_annotation(annotation: object) -> bool:
    return get_origin(annotation) is BidiChannel or annotation is BidiChannel


def bidi_types(annotation: object) -> tuple[Any, Any] | None:
    """Return (send_type, recv_type) from a ``bidi[S, R]`` annotation."""
    args = get_args(annotation)
    if len(args) != 2:
        return None
    return args[0], args[1]
