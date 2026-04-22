import secrets
import time
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient

from . import audit
from .config import AUTH_READY, CLERK_ISSUER, CLERK_JWKS_URL
from .db import connect


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


def _get_or_create_user(clerk_user_id: str, email: Optional[str]) -> dict:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, clerk_user_id, email, bookmarklet_token FROM users WHERE clerk_user_id = ?",
            (clerk_user_id,),
        ).fetchone()
        if row:
            if email and row["email"] != email:
                conn.execute(
                    "UPDATE users SET email = ? WHERE id = ?", (email, row["id"])
                )
            return dict(row)
        bookmarklet_token = secrets.token_urlsafe(24)
        cur = conn.execute(
            "INSERT INTO users (clerk_user_id, email, bookmarklet_token) VALUES (?, ?, ?)",
            (clerk_user_id, email, bookmarklet_token),
        )
        return {
            "id": cur.lastrowid,
            "clerk_user_id": clerk_user_id,
            "email": email,
            "bookmarklet_token": bookmarklet_token,
        }


def current_user(request: Request) -> dict:
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
                "SELECT id, clerk_user_id, email, bookmarklet_token FROM users WHERE bookmarklet_token = ?",
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
