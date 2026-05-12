"""Field-level 422 validation errors for msgspec + Pydantic bodies."""

# pyright: basic

from __future__ import annotations

import msgspec
from starlette.testclient import TestClient

from tythe import App


class Inner(msgspec.Struct):
    name: str
    weight: float


class Outer(msgspec.Struct):
    label: str
    items: list[Inner]


def test_missing_top_level_field() -> None:
    app = App()

    @app.post("/posts")
    async def create(data: Outer) -> dict[str, str]:
        return {"label": data.label}

    r = TestClient(app).post("/posts", json={"items": []})
    assert r.status_code == 422
    body = r.json()
    assert body["location"] == "body"
    assert body["field"] is not None
    assert "label" in body["field"]


def test_nested_field_type_error() -> None:
    app = App()

    @app.post("/posts")
    async def create(data: Outer) -> dict[str, str]:
        return {"label": data.label}

    payload = {
        "label": "x",
        "items": [
            {"name": "a", "weight": 1.0},
            {"name": "b", "weight": "not-a-number"},
        ],
    }
    r = TestClient(app).post("/posts", json=payload)
    assert r.status_code == 422
    body = r.json()
    assert body["location"] == "body"
    # path scoped under the body alias + index + field name
    assert "items" in body["field"]


def test_missing_query_param() -> None:
    from typing import Annotated

    from tythe.params import Query

    app = App()

    @app.get("/search")
    async def search(q: Annotated[str, Query()]) -> dict[str, str]:
        return {"q": q}

    r = TestClient(app).get("/search")
    assert r.status_code == 422
    body = r.json()
    assert body["location"] == "query"
    assert body["field"] == "q"
    assert body["value"] is None


def test_pydantic_field_path() -> None:
    import pydantic

    class CreatePost(pydantic.BaseModel):
        title: str
        author: pydantic.BaseModel  # placeholder, overridden below

    class Author(pydantic.BaseModel):
        name: str
        email: str

    class Post(pydantic.BaseModel):
        title: str
        author: Author

    app = App()

    @app.post("/posts")
    async def create(data: Post) -> dict[str, str]:
        return {"title": data.title}

    r = TestClient(app).post(
        "/posts",
        json={"title": "x", "author": {"name": "ada"}},  # email missing
    )
    assert r.status_code == 422
    body = r.json()
    assert body["location"] == "body"
    assert "author.email" in body["field"] or "email" in body["field"]
