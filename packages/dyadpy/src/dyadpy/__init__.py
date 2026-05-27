"""Deprecated. ``dyadpy`` is now ``causeway`` — install causeway instead.

This package is a compatibility shim that re-exports every public symbol
from ``causeway`` (and aliases every legacy submodule under ``dyadpy.*``)
so existing imports keep working while you migrate:

    pip uninstall dyadpy
    pip install 'causeway>=0.5'
    # then s/from dyadpy/from causeway/ across the codebase

This shim will be removed in causeway 0.6.
"""

from __future__ import annotations

import sys
import warnings
from typing import Any

warnings.warn(
    "The 'dyadpy' package has been merged into 'causeway' as causeway._runtime. "
    "Replace `from dyadpy import X` with `from causeway import X`. "
    "This shim will be removed in causeway 0.6.",
    DeprecationWarning,
    stacklevel=2,
)

# Re-export the public surface from causeway's top-level package.
from causeway import (  # noqa: E402
    App,
    BidiChannel,
    Bytes,
    Context,
    Depends,
    Form,
    SsePayload,
    after,
    bidi,
    raises,
    stream,
)

# Alias every legacy ``dyadpy.<sub>`` submodule to the corresponding
# ``causeway._runtime.<sub>`` (and ``dyadpy._traceback`` to the top-level
# ``causeway._traceback``) so ``import dyadpy.context`` keeps resolving.
import importlib  # noqa: E402

_SUBMODULES = (
    "_idents",
    "_pydantic",
    "app",
    "bidi",
    "codegen",
    "context",
    "diff",
    "errors",
    "ir",
    "openapi",
    "otel",
    "params",
    "polyglot",
    "runtime",
    "streaming",
    "tasks",
)
for _sub in _SUBMODULES:
    sys.modules[f"dyadpy.{_sub}"] = importlib.import_module(f"causeway._runtime.{_sub}")
sys.modules["dyadpy._traceback"] = importlib.import_module("causeway._traceback")
del _sub
del importlib

_LAZY_TASKS = {"InMemoryBackend", "TaskBackend", "TaskState", "mount_task_routes"}

__version__ = "0.2.0"


def __getattr__(name: str) -> Any:
    if name in _LAZY_TASKS:
        import importlib

        return getattr(importlib.import_module("causeway._runtime.tasks"), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "App",
    "BidiChannel",
    "Bytes",
    "Context",
    "Depends",
    "Form",
    "InMemoryBackend",
    "SsePayload",
    "TaskBackend",
    "TaskState",
    "__version__",
    "after",
    "bidi",
    "mount_task_routes",
    "raises",
    "stream",
]
