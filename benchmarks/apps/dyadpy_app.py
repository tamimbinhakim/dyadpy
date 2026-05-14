"""Dyadpy benchmark target. Identical wire shape to the FastAPI / Litestar peers."""

from __future__ import annotations

import msgspec

from dyadpy import App

app = App()


class EchoIn(msgspec.Struct):
    text: str


class EchoOut(msgspec.Struct):
    text: str


class User(msgspec.Struct):
    id: int
    name: str


@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.get("/users/{id}")
async def get_user(id: int) -> User:
    return User(id=id, name=f"user-{id}")


@app.post("/echo")
async def echo(body: EchoIn) -> EchoOut:
    return EchoOut(text=body.text)


@app.get("/list")
async def list_users() -> list[User]:
    return [User(id=i, name=f"user-{i}") for i in range(50)]
