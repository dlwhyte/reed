import os
import secrets
import time
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient

from . import audit
from .config import AUTH_READY, BOOTSTRAP_ADMIN_EMAIL, CLERK_ISSUER, CLERK_JWKS_URL
from .db import connect


# E2E bypass — only honored when Clerk is NOT configured (i.e. dev/test
# environments). In prod, AUTH_READY is True because CLERK_JWKS_URL is
# set, and this flag is ignored. Belt-and-braces: a stray env var on the
# prod server can never disable auth.
_E2E_BYPASS = (
    os.getenv("E2E_AUTH_BYPASS", "false").lower() == "true" and not AUTH_READY
)
_E2E_USER_CLERK_ID = "e2e-user"


def _e2e_user() -> dict:
    """Return the seeded e2e user. Caller is expected to have inserted it
    via frontend/e2e/seed_db.py before the test run."""
    with connect() as conn:
        row = conn.execute(
            "SELECT id, clerk_user_id, email, bookmarklet_token, tier "
            "FROM users WHERE clerk_user_id = ?",
            (_E2E_USER_CLERK_ID,),
        ).fetchone()
    if not row:
        raise HTTPException(
            status_code=500,
            detail="E2E_AUTH_BYPASS=true but no e2e user seeded — "
            "run frontend/e2e/seed_db.py first.",
        )
    return dict(row)


_JWKS_CLIENT: Optional[PyJWKClient] = None


def _jwks_client() -> PyJWKClient:
    global _JWKS_CLIENT
    if _JWKS_CLIENT is None:
        if not AUTH_READY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth not configured (missing CLERK_JWKS_URL / CLERK_ISSUER)",
            )
        _JWKS_CLIENT = PyJWKClient(CLERK_JWKS_URL, cache_keys=True)
    return _JWKS_CLIENT


def _verify_clerk_jwt(token: str, request: Optional[Request] = None) -> dict:
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError as e:
        audit.record("expired_jwt", request, detail=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.PyJWTError as e:
        audit.record("invalid_jwt", request, detail=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )
    exp = claims.get("exp")
    if exp and exp < time.time():
        audit.record("expired_jwt", request, detail="exp in past")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    return claims


def _bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    parts = auth.split(None, 1)
    if len(parts) < 2:
        return None
    return parts[1].strip() or None


def _should_bootstrap_admin(email: Optional[str]) -> bool:
    if not BOOTSTRAP_ADMIN_EMAIL or not email:
        return False
    return email.strip().lower() == BOOTSTRAP_ADMIN_EMAIL


def _get_or_create_user(clerk_user_id: str, email: Optional[str]) -> dict:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, clerk_user_id, email, bookmarklet_token, tier FROM users WHERE clerk_user_id = ?",
            (clerk_user_id,),
        ).fetchone()
        if row:
            updates = []
            params: list = []
            if email and row["email"] != email:
                updates.append("email = ?")
                params.append(email)
            new_tier = row["tier"]
            if _should_bootstrap_admin(email) and row["tier"] != "admin":
                updates.append("tier = 'admin'")
                new_tier = "admin"
            if updates:
                params.append(row["id"])
                conn.execute(
                    f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
                    tuple(params),
                )
            return {
                "id": row["id"],
                "clerk_user_id": row["clerk_user_id"],
                "email": email or row["email"],
                "bookmarklet_token": row["bookmarklet_token"],
                "tier": new_tier,
            }
        bookmarklet_token = secrets.token_urlsafe(24)
        tier = "admin" if _should_bootstrap_admin(email) else "free"
        cur = conn.execute(
            "INSERT INTO users (clerk_user_id, email, bookmarklet_token, tier) "
            "VALUES (?, ?, ?, ?)",
            (clerk_user_id, email, bookmarklet_token, tier),
        )
        return {
            "id": cur.lastrowid,
            "clerk_user_id": clerk_user_id,
            "email": email,
            "bookmarklet_token": bookmarklet_token,
            "tier": tier,
        }


def current_user(request: Request) -> dict:
    if _E2E_BYPASS:
        return _e2e_user()
    token = _bearer_token(request)
    if not token:
        audit.record("missing_bearer", request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    claims = _verify_clerk_jwt(token, request)
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        audit.record("invalid_jwt", request, detail="missing sub")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub"
        )
    email = claims.get("email") or (claims.get("email_addresses") or [None])[0]
    return _get_or_create_user(clerk_user_id, email)


def current_user_or_bookmarklet(request: Request) -> dict:
    if _E2E_BYPASS:
        return _e2e_user()
    token = _bearer_token(request)
    if token:
        claims = _verify_clerk_jwt(token, request)
        clerk_user_id = claims.get("sub")
        if not clerk_user_id:
            audit.record("invalid_jwt", request, detail="missing sub")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub"
            )
        email = claims.get("email") or (claims.get("email_addresses") or [None])[0]
        return _get_or_create_user(clerk_user_id, email)

    bm = request.query_params.get("token") or request.query_params.get("t")
    if bm:
        with connect() as conn:
            row = conn.execute(
                "SELECT id, clerk_user_id, email, bookmarklet_token, tier FROM users WHERE bookmarklet_token = ?",
                (bm,),
            ).fetchone()
            if row:
                return dict(row)
        # Token was provided but didn't match any user — log the first few
        # bytes (never the full token) so we can spot brute-force patterns.
        audit.record("invalid_bookmarklet", request, detail=bm[:6] + "…")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bookmarklet token",
        )

    audit.record("missing_bearer", request)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing bearer token or bookmarklet token",
    )


def regenerate_bookmarklet_token(user_id: int) -> str:
    token = secrets.token_urlsafe(24)
    with connect() as conn:
        conn.execute(
            "UPDATE users SET bookmarklet_token = ? WHERE id = ?", (token, user_id)
        )
    return token
