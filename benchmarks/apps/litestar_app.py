"""Litestar benchmark target. Same wire shape as Dyadpy / FastAPI peers."""

# pyright: basic

from __future__ import annotations

import msgspec
from litestar import Litestar, get, post


class EchoIn(msgspec.Struct):
    text: str


class EchoOut(msgspec.Struct):
    text: str


class User(msgspec.Struct):
    id: int
    name: str


@get("/healthz", sync_to_thread=False)
def healthz() -> dict[str, bool]:
    return {"ok": True}


@get("/users/{id:int}", sync_to_thread=False)
def get_user(id: int) -> User:
    return User(id=id, name=f"user-{id}")


@post("/echo", sync_to_thread=False)
def echo(data: EchoIn) -> EchoOut:
    return EchoOut(text=data.text)


@get("/list", sync_to_thread=False)
def list_users() -> list[User]:
    return [User(id=i, name=f"user-{i}") for i in range(50)]


app = Litestar(route_handlers=[healthz, get_user, echo, list_users], openapi_config=None)
