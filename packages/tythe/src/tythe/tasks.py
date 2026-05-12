"""Long-running jobs via a pluggable queue.

Submit a coroutine returning ``T``, get a task-id back, poll
``backend.status(id)`` or iterate ``backend.stream(id)`` for live progress.
The backend is swappable — ``InMemoryBackend`` ships in core; Redis / SQS
adapters belong in their own packages so the core stays dependency-light.

Backend implementations expose four primitives: ``enqueue``, ``status``,
``stream``, ``cancel``. Anything that satisfies the ``TaskBackend``
Protocol qualifies.
"""

from __future__ import annotations

import asyncio
import contextlib
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field, replace
from typing import Any, Generic, Literal, Protocol, TypeVar, runtime_checkable

T = TypeVar("T")

TaskStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]


@dataclass(slots=True)
class TaskState(Generic[T]):
    task_id: str
    status: TaskStatus
    result: T | None = None
    error: str | None = None
    progress: float = 0.0  # 0..1
    enqueued_at: float = 0.0
    started_at: float | None = None
    finished_at: float | None = None


@runtime_checkable
class TaskBackend(Protocol):
    """Minimal queue interface. Adapter packages (Redis/SQS) implement this."""

    async def enqueue(
        self, fn: Callable[..., Awaitable[Any]], *args: Any, **kwargs: Any
    ) -> str: ...

    async def status(self, task_id: str) -> TaskState[Any]: ...

    def stream(self, task_id: str) -> AsyncIterator[TaskState[Any]]: ...

    async def cancel(self, task_id: str) -> None: ...


@dataclass(slots=True)
class _InMemoryRecord:
    state: TaskState[Any]
    task: asyncio.Task[Any] | None = None
    listeners: list[asyncio.Queue[TaskState[Any]]] = field(
        default_factory=lambda: [],
    )


class InMemoryBackend:
    """Single-process backend. Loses everything on restart — for dev and tests.

    Production deployments swap this for the Redis / SQS adapter packages.
    """

    def __init__(self) -> None:
        self._records: dict[str, _InMemoryRecord] = {}

    async def enqueue(self, fn: Callable[..., Awaitable[Any]], *args: Any, **kwargs: Any) -> str:
        task_id = uuid.uuid4().hex
        record = _InMemoryRecord(
            state=TaskState(task_id=task_id, status="queued", enqueued_at=time.time()),
        )
        self._records[task_id] = record

        async def runner() -> None:
            self._broadcast(record, "running", started_at=time.time())
            try:
                result = await fn(*args, **kwargs)
            except asyncio.CancelledError:
                self._broadcast(record, "cancelled", finished_at=time.time())
                raise
            except Exception as exc:
                self._broadcast(record, "failed", finished_at=time.time(), error=repr(exc))
                return
            self._broadcast(
                record, "succeeded", finished_at=time.time(), result=result, progress=1.0
            )

        record.task = asyncio.create_task(runner())
        return task_id

    def _broadcast(self, record: _InMemoryRecord, status: TaskStatus, **fields: Any) -> None:
        for k, v in fields.items():
            setattr(record.state, k, v)
        record.state.status = status
        snapshot = replace(record.state)
        for q in record.listeners:
            with contextlib.suppress(asyncio.QueueFull):  # pragma: no cover
                q.put_nowait(snapshot)

    async def status(self, task_id: str) -> TaskState[Any]:
        record = self._records.get(task_id)
        if record is None:
            raise KeyError(task_id)
        return replace(record.state)

    async def stream(self, task_id: str) -> AsyncIterator[TaskState[Any]]:
        record = self._records.get(task_id)
        if record is None:
            raise KeyError(task_id)
        queue: asyncio.Queue[TaskState[Any]] = asyncio.Queue(maxsize=64)
        record.listeners.append(queue)
        # Replay current state once so consumers don't miss the initial value.
        queue.put_nowait(replace(record.state))
        try:
            while True:
                state = await queue.get()
                yield state
                if state.status in ("succeeded", "failed", "cancelled"):
                    return
        finally:
            with contextlib.suppress(ValueError):  # pragma: no cover
                record.listeners.remove(queue)

    async def cancel(self, task_id: str) -> None:
        record = self._records.get(task_id)
        if record is None or record.task is None:
            return
        record.task.cancel()
