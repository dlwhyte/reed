"""Named, revocable API tokens for the `/api/agent/*` endpoints.

Separate from the bookmarklet token (which is a single per-user long-lived
token for save/list, shared across the bookmarklet + browser extension).
API tokens are:
- Created on demand, one per AI tool (Claude Code, ChatGPT, Cursor, etc.)
- Named by the user so they can tell which tool is which
- Stored as SHA-256 hashes — the raw token is shown once on creation and
  never stored. Lost tokens must be regenerated.
- Revocable without impacting other tokens
- Tracked with a `last_used_at` timestamp so the user can spot stale ones

Token format: `bft_<24-byte-urlsafe-base64>` — the `bft_` prefix makes it
easy to recognise BrowseFellow tokens in logs and configs, and the
length matches other common API-key shapes.
"""
from __future__ import annotations

import hashlib
import secrets
from typing import Optional

from . import db


TOKEN_PREFIX = "bft_"
# The visible prefix we store alongside the hash so tokens can be
# identified in the UI without revealing the raw token.
SHOWN_PREFIX_LEN = 8  # e.g. "bft_aBcD"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create(user_id: int, name: str) -> tuple[str, dict]:
    """Mint a fresh token for the user. Returns (raw_token, row).
    The caller shows the raw token to the user exactly once."""
    raw = TOKEN_PREFIX + secrets.token_urlsafe(24)
    h = _hash(raw)
    prefix = raw[:SHOWN_PREFIX_LEN]
    with db.connect() as conn:
        cur = conn.execute(
            "INSERT INTO api_tokens (user_id, name, token_hash, prefix) "
            "VALUES (?, ?, ?, ?)",
            (user_id, name, h, prefix),
        )
        row = conn.execute(
            "SELECT id, user_id, name, prefix, last_used_at, created_at, revoked_at "
            "FROM api_tokens WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return raw, dict(row)


def list_for_user(user_id: int) -> list[dict]:
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT id, name, prefix, last_used_at, created_at, revoked_at "
            "FROM api_tokens WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def revoke(user_id: int, token_id: int) -> bool:
    """Soft-revoke: mark revoked_at without deleting, so the audit trail
    stays intact. Returns True if a row was updated, False if not found."""
    with db.connect() as conn:
        cur = conn.execute(
            "UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP "
            "WHERE user_id = ? AND id = ? AND revoked_at IS NULL",
            (user_id, token_id),
        )
    return cur.rowcount > 0


def verify(raw_token: str) -> Optional[dict]:
    """Resolve a raw token to a user dict, or None if the token is
    unknown / revoked. On success, updates last_used_at."""
    if not raw_token or not raw_token.startswith(TOKEN_PREFIX):
        return None
    h = _hash(raw_token)
    with db.connect() as conn:
        row = conn.execute(
            "SELECT t.id AS token_id, t.name AS token_name, t.revoked_at, "
            "       u.id, u.clerk_user_id, u.email, u.bookmarklet_token, u.tier "
            "FROM api_tokens t JOIN users u ON u.id = t.user_id "
            "WHERE t.token_hash = ?",
            (h,),
        ).fetchone()
        if not row or row["revoked_at"]:
            return None
        conn.execute(
            "UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (row["token_id"],),
        )
    return {
        "id": row["id"],
        "clerk_user_id": row["clerk_user_id"],
        "email": row["email"],
        "bookmarklet_token": row["bookmarklet_token"],
        "tier": row["tier"],
        "_api_token_id": row["token_id"],
        "_api_token_name": row["token_name"],
    }
