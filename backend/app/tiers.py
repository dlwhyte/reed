"""Tier-based feature gating + monthly usage caps.

Three tiers:
- free   — read/save/highlight/keyword search/AI summary on save/semantic
           search/similar. Capped at 200 saves/month. NO chat or research.
- plus   — adds chat (100 turns/mo) and research agent (30 runs/mo).
           Save cap removed. Invite-only — admin promotes via the admin UI.
- admin  — everything, no caps. Bootstrap via BOOTSTRAP_ADMIN_EMAIL env
           var or by another admin promoting through the admin UI.

Usage counting:
- 'save'      → COUNT(*) FROM articles WHERE created_at >= start of month
- 'chat'      → COUNT(*) FROM cohere_usage WHERE endpoint='chat' …
- 'research'  → COUNT(*) FROM cohere_usage WHERE endpoint='research_run' …
   (one 'research_run' marker is inserted at the start of each /research
   call, distinct from the 'agent' rows that track per-step token spend)
"""
from __future__ import annotations

from typing import Callable, Optional

from fastapi import Depends, HTTPException, Request, status

from . import db
from .auth import current_user


TIERS: dict[str, dict] = {
    "free": {
        "rank": 0,
        "label": "Free",
        "features": {"chat": False, "research": False},
        # None = unlimited; 0 = feature not granted at this tier
        "caps": {"save": 200, "chat": 0, "research": 0},
    },
    "plus": {
        "rank": 1,
        "label": "Plus",
        "features": {"chat": True, "research": True},
        "caps": {"save": None, "chat": 100, "research": 30},
    },
    "admin": {
        "rank": 2,
        "label": "Admin",
        "features": {"chat": True, "research": True},
        "caps": {"save": None, "chat": None, "research": None},
    },
}

DEFAULT_TIER = "free"


def tier_of(user: dict) -> dict:
    return TIERS.get(user.get("tier") or DEFAULT_TIER, TIERS[DEFAULT_TIER])


def has_feature(user: dict, feature: str) -> bool:
    return tier_of(user)["features"].get(feature, False)


def cap_for(user: dict, kind: str) -> Optional[int]:
    """Return the monthly cap for a resource. None means unlimited."""
    return tier_of(user)["caps"].get(kind)


def usage_this_month(user_id: int, kind: str) -> int:
    """Count the given resource's usage for the current calendar month."""
    if kind == "save":
        sql = (
            "SELECT COUNT(*) FROM articles "
            "WHERE user_id = ? AND created_at >= date('now', 'start of month')"
        )
    elif kind == "chat":
        sql = (
            "SELECT COUNT(*) FROM cohere_usage "
            "WHERE user_id = ? AND endpoint = 'chat' "
            "AND ts >= date('now', 'start of month')"
        )
    elif kind == "research":
        sql = (
            "SELECT COUNT(*) FROM cohere_usage "
            "WHERE user_id = ? AND endpoint = 'research_run' "
            "AND ts >= date('now', 'start of month')"
        )
    else:
        return 0
    with db.connect() as conn:
        row = conn.execute(sql, (user_id,)).fetchone()
    return int(row[0] or 0)


def remaining(user: dict, kind: str) -> Optional[int]:
    cap = cap_for(user, kind)
    if cap is None:
        return None
    return max(0, cap - usage_this_month(user["id"], kind))


def mark_research_run(user_id: int) -> None:
    """Record a 'research_run' marker so the cap query can count whole
    user-initiated runs separately from the per-step 'agent' token rows."""
    try:
        with db.connect() as conn:
            conn.execute(
                "INSERT INTO cohere_usage (user_id, endpoint, model, input_tokens, output_tokens) "
                "VALUES (?, 'research_run', 'meta', 0, 0)",
                (user_id,),
            )
    except Exception as e:
        print(f"[tiers] mark_research_run failed: {e}")


def check_save_cap(user: dict) -> None:
    """Raise 429 if the user is at their save cap. Inline check; doesn't
    re-trigger auth so it composes with current_user_or_bookmarklet."""
    cap = cap_for(user, "save")
    if cap is None:
        return
    used = usage_this_month(user["id"], "save")
    if used >= cap:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Monthly save cap reached ({used}/{cap}). Resets on the 1st, "
                "or upgrade to Plus for unlimited saves."
            ),
        )


def check_feature_and_cap(user: dict, kind: str) -> None:
    """Raise 403 if the user doesn't have the feature, 429 if they have it
    but are at their monthly cap. Inline check."""
    feat_allowed = has_feature(user, kind)
    cap = cap_for(user, kind)
    if not feat_allowed or cap == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"The {kind} feature requires the Plus tier.",
        )
    if cap is not None:
        used = usage_this_month(user["id"], kind)
        if used >= cap:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Monthly {kind} cap reached ({used}/{cap}). Resets on the 1st.",
            )


def require_admin() -> Callable:
    """FastAPI dep — 403s anyone whose tier is not 'admin'. Used as the
    only auth dep on /api/admin/* endpoints."""

    def dep(user: dict = Depends(current_user)) -> dict:
        if (user.get("tier") or DEFAULT_TIER) != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin only.",
            )
        return user

    return dep
