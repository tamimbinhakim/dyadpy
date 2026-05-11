"""Bidi annotation helpers test."""

# pyright: basic

from __future__ import annotations

import msgspec

from tythe import bidi
from tythe.bidi import bidi_types, is_bidi_annotation


class ClientMsg(msgspec.Struct, tag_field="kind", tag="client"):
    text: str


class ServerMsg(msgspec.Struct, tag_field="kind", tag="server"):
    text: str


def test_bidi_annotation_recognized() -> None:
    annot = bidi[ServerMsg, ClientMsg]
    assert is_bidi_annotation(annot)
    types = bidi_types(annot)
    assert types == (ServerMsg, ClientMsg)


def test_non_bidi_annotation_not_recognized() -> None:
    assert not is_bidi_annotation(str)
    assert bidi_types(str) is None
