"""FastAPI benchmark target. Same wire shape as Tythe / Litestar peers."""

# pyright: basic

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class EchoIn(BaseModel):
    text: str


class EchoOut(BaseModel):
    text: str


class User(BaseModel):
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
