"""Lightweight audit log for security-relevant events.

Events go into the `auth_events` SQLite table so we can spot patterns
later: brute-force attempts on bookmarklet tokens, expired-JWT bursts,
rate-limit hits clustered around one IP, etc.

Recording is best-effort — a DB error here must never block the
user-facing request that triggered it.

Event names are short snake_case strings. The current vocabulary:
- 'missing_bearer'        — protected endpoint hit with no Authorization
- 'invalid_jwt'           — bearer present but signature/issuer/exp failed
- 'expired_jwt'           — bearer with valid sig but exp in the past
- 'invalid_bookmarklet'   — ?token= didn't match any user
- 'rate_limit'            — request rejected by the per-endpoint limiter
"""
from __future__ import annotations

from typing import Optional

from fastapi import Request

from . import db


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for", "") if request.headers else ""
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def record(
    event: str,
    request: Optional[Request] = None,
    *,
    detail: Optional[str] = None,
    user_id: Optional[int] = None,
) -> None:
    try:
        path = request.url.path if request and request.url else None
        ip = _client_ip(request)
        with db.connect() as conn:
            conn.execute(
                "INSERT INTO auth_events (event, ip, user_id, detail, path) "
                "VALUES (?, ?, ?, ?, ?)",
                (event, ip, user_id, detail, path),
            )
    except Exception as e:
        # Audit logging must never break the user-facing path.
        print(f"[audit] failed to record {event!r}: {e}")
