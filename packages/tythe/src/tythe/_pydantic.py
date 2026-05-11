"""Pydantic interop — first-class peer to msgspec.

Detection is lazy: we never import ``pydantic`` at module-load time. If a
handler annotates a parameter or return value with a ``BaseModel`` subclass
we'll catch it via ``is_pydantic_model`` and route validation + schema
extraction through Pydantic. msgspec stays the default; Pydantic plugs in.
"""

from __future__ import annotations

from typing import Any

_PYDANTIC_BASE_MODEL: Any = None
_IMPORT_TRIED = False


def _try_import() -> Any:
    """Return ``pydantic.BaseModel`` or ``None`` if Pydantic isn't installed.

    Cached so the import attempt only happens once per process.
    """
    global _PYDANTIC_BASE_MODEL, _IMPORT_TRIED
    if _IMPORT_TRIED:
        return _PYDANTIC_BASE_MODEL
    _IMPORT_TRIED = True
    try:
        from pydantic import BaseModel
    except ImportError:
        return None
    _PYDANTIC_BASE_MODEL = BaseModel
    return BaseModel


def is_pydantic_model(t: object) -> bool:
    base = _try_import()
    if base is None:
        return False
    try:
        return isinstance(t, type) and issubclass(t, base)
    except TypeError:
        return False


def validate(t: type, value: Any) -> Any:
    """Run a value through Pydantic validation. Caller asserts ``t`` is a model."""
    return t.model_validate(value)  # type: ignore[attr-defined]


def json_schema(t: type) -> dict[str, Any]:
    """Return the Pydantic-emitted JSON schema for a model."""
    return t.model_json_schema()  # type: ignore[attr-defined,no-any-return]


def to_jsonable(value: Any) -> Any:
    """Convert a Pydantic instance to plain JSON-able dict; pass-through otherwise."""
    base = _try_import()
    if base is None or not isinstance(value, base):
        return value
    return value.model_dump(mode="json")
