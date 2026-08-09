import os
import time
from typing import Optional

import jwt
from fastapi import HTTPException, Request, status
from jwt import PyJWKClient

from .config import AUTH_READY, CLERK_ISSUER, CLERK_JWKS_URL
from .db import connect


# Honored only when Clerk is NOT configured (dev/test). A stray env var on
# a prod server can never disable auth, since AUTH_READY would be True there.
_E2E_BYPASS = (
    os.getenv("E2E_AUTH_BYPASS", "false").lower() == "true" and not AUTH_READY
)
_E2E_USER_CLERK_ID = "e2e-user"


def _e2e_user() -> dict:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, clerk_user_id, email FROM users WHERE clerk_user_id = ?",
            (_E2E_USER_CLERK_ID,),
        ).fetchone()
    if not row:
        raise HTTPException(
            status_code=500,
            detail="E2E_AUTH_BYPASS=true but no e2e user seeded.",
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


def _verify_clerk_jwt(token: str) -> dict:
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}"
        )
    exp = claims.get("exp")
    if exp and exp < time.time():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
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
            "SELECT id, clerk_user_id, email FROM users WHERE clerk_user_id = ?",
            (clerk_user_id,),
        ).fetchone()
        if row:
            if email and row["email"] != email:
                conn.execute("UPDATE users SET email = ? WHERE id = ?", (email, row["id"]))
            return {"id": row["id"], "clerk_user_id": row["clerk_user_id"], "email": email or row["email"]}
        cur = conn.execute(
            "INSERT INTO users (clerk_user_id, email) VALUES (?, ?)",
            (clerk_user_id, email),
        )
        return {"id": cur.lastrowid, "clerk_user_id": clerk_user_id, "email": email}


def current_user(request: Request) -> dict:
    if _E2E_BYPASS:
        return _e2e_user()
    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    claims = _verify_clerk_jwt(token)
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub")
    email = claims.get("email") or (claims.get("email_addresses") or [None])[0]
    return _get_or_create_user(clerk_user_id, email)
