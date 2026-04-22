"""Tiny in-process rate limiter, exposed as FastAPI dependencies.

Why not slowapi: slowapi's `@limiter.limit(...)` decorator wraps the
endpoint in a way that breaks Pydantic's annotation resolution under
`from __future__ import annotations` on Python 3.9. We don't actually
need anything fancy — a token-bucket per (user-or-IP) key in a dict is
enough at our scale (one process, low QPS, single VPS).

Each call to `make_limiter(rate_per_minute)` returns a FastAPI dep that
either lets the request through or raises HTTPException(429).

Key derivation:
- Authenticated user → SHA-256 of their bearer token (so collisions
  across users are vanishingly unlikely and the raw token never leaks
  into logs).
- Bookmarklet token → SHA-256 of the `?token=` value.
- Anonymous → first IP from X-Forwarded-For (we run behind nginx, so
  `request.client.host` is always 127.0.0.1).
"""
from __future__ import annotations

import hashlib
import os
from threading import Lock
from time import monotonic
from typing import Callable, Optional

from fastapi import HTTPException, Request


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _key(request: Request) -> str:
    auth = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        parts = auth.split(None, 1)
        if len(parts) > 1 and parts[1].strip():
            return "user:" + hashlib.sha256(parts[1].strip().encode()).hexdigest()[:16]
    bm: Optional[str] = request.query_params.get("token") or request.query_params.get("t")
    if bm:
        return "bm:" + hashlib.sha256(bm.encode()).hexdigest()[:16]
    return "ip:" + _client_ip(request)


_ENABLED = os.getenv("RATELIMIT_ENABLED", "true").lower() == "true"


class _TokenBucket:
    """Per-key token bucket. Tokens regenerate at `rate` per second up to
    `burst`, taken one at a time. State lives in a single dict; locked
    because Starlette can interleave requests on async endpoints.
    """

    __slots__ = ("rate", "burst", "buckets", "lock")

    def __init__(self, rate: float, burst: int):
        self.rate = rate
        self.burst = burst
        self.buckets: dict[str, tuple[float, float]] = {}
        self.lock = Lock()

    def take(self, key: str) -> bool:
        now = monotonic()
        with self.lock:
            tokens, last = self.buckets.get(key, (float(self.burst), now))
            tokens = min(float(self.burst), tokens + (now - last) * self.rate)
            if tokens < 1.0:
                self.buckets[key] = (tokens, now)
                return False
            self.buckets[key] = (tokens - 1.0, now)
            return True


def make_limiter(per_minute: float, burst: Optional[int] = None) -> Callable:
    """Return a FastAPI dependency that enforces `per_minute` requests
    per key, with an initial burst capacity (defaults to `per_minute`)."""
    bucket = _TokenBucket(rate=per_minute / 60.0, burst=int(burst or per_minute))

    def dep(request: Request) -> None:
        if not _ENABLED:
            return
        if not bucket.take(_key(request)):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded — slow down and try again in a minute.",
            )

    return dep


def reset_for_tests() -> None:
    """Test helper — wipe state between tests so limits don't leak across them."""
    # Each limiter has its own bucket; we don't track them centrally. Tests
    # that need isolation should construct fresh limiters or set
    # RATELIMIT_ENABLED=false. Provided as a hook in case we add a registry
    # later.
