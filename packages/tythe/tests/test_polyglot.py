"""Polyglot codegen smoke tests — Swift + Kotlin renderers."""

# pyright: basic

from __future__ import annotations

import msgspec

from tythe import App
from tythe.ir import build_ir
from tythe.polyglot import render_kotlin, render_swift


def _build_ir():
    class Post(msgspec.Struct):
        id: int
        title: str

    app = App()

    @app.get("/posts/{post_id}")
    async def get_post(post_id: int) -> Post:
        return Post(id=post_id, title="x")

    return build_ir(app)


def test_swift_emits_struct_and_method() -> None:
    out = render_swift(_build_ir())
    assert "public struct Post: Codable" in out
    assert "public let id:" in out
    assert "public func getPost" in out


def test_kotlin_emits_data_class_and_method() -> None:
    out = render_kotlin(_build_ir(), package="example")
    assert "package example" in out
    assert "data class Post" in out
    assert "val id:" in out
    assert "suspend fun getPost" in out
