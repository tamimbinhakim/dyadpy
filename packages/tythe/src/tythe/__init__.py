"""Tythe — a type-safe RPC bridge between Python and TypeScript.

The function signature is the contract. See
https://github.com/tamimbinhakim/tythe for full docs.
"""

from __future__ import annotations

from tythe.app import App
from tythe.bidi import BidiChannel, bidi
from tythe.context import Context, Depends
from tythe.errors import raises
from tythe.streaming import stream
from tythe.tasks import InMemoryBackend, Task, TaskBackend, TaskState, default_backend

__all__ = [
    "App",
    "BidiChannel",
    "Context",
    "Depends",
    "InMemoryBackend",
    "Task",
    "TaskBackend",
    "TaskState",
    "bidi",
    "default_backend",
    "raises",
    "stream",
]

__version__ = "0.1.0"
