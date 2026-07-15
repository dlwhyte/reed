"""Tests for extractor.fetch_html's streaming size cap."""
from __future__ import annotations

import httpx
import pytest

from app import extractor

_RealAsyncClient = httpx.AsyncClient


def _client_with_transport(handler):
    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return _RealAsyncClient(*args, **kwargs)

    return factory


@pytest.mark.asyncio
async def test_fetch_html_rejects_over_cap(monkeypatch):
    body = b"a" * (11 * 1024 * 1024)  # 11 MiB, over the 10 MiB cap

    def handler(request):
        return httpx.Response(200, content=body)

    monkeypatch.setattr(extractor.httpx, "AsyncClient", _client_with_transport(handler))

    with pytest.raises(httpx.HTTPError, match="10 MiB cap"):
        await extractor.fetch_html("https://example.com/big")


@pytest.mark.asyncio
async def test_fetch_html_allows_under_cap(monkeypatch):
    body = b"a" * (9 * 1024 * 1024)  # 9 MiB, under the 10 MiB cap

    def handler(request):
        return httpx.Response(200, content=body)

    monkeypatch.setattr(extractor.httpx, "AsyncClient", _client_with_transport(handler))

    html = await extractor.fetch_html("https://example.com/big")
    assert len(html) == len(body)
