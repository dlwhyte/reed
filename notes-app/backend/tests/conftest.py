"""Shared pytest fixtures. Mirrors the pattern in backend/tests/conftest.py
(reed's main app), trimmed to this app's much simpler user model — no
bookmarklet token, no tiers, just clerk_user_id + email.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

_APP_ROOT = Path(__file__).resolve().parent.parent
if str(_APP_ROOT) not in sys.path:
    sys.path.insert(0, str(_APP_ROOT))

_TMP_DATA_DIR = tempfile.mkdtemp(prefix="notes-app-tests-")
os.environ["NOTES_DATA_DIR"] = _TMP_DATA_DIR
os.environ["RATELIMIT_ENABLED"] = "false"


@pytest.fixture
def db_setup(monkeypatch):
    from app import config, db

    db_dir = tempfile.mkdtemp(prefix="notes-app-tests-db-")
    test_path = Path(db_dir) / "notes.db"
    monkeypatch.setattr(config, "DB_PATH", test_path)
    monkeypatch.setattr(db, "DB_PATH", test_path)

    db.init_db()

    def seed_user(clerk_id: str, email: str) -> dict:
        with db.connect() as conn:
            cur = conn.execute(
                "INSERT INTO users (clerk_user_id, email) VALUES (?, ?)",
                (clerk_id, email),
            )
            return {"id": cur.lastrowid, "clerk_user_id": clerk_id, "email": email}

    return seed_user


@pytest.fixture
def client(db_setup):
    from fastapi.testclient import TestClient

    test_user = db_setup("test_user_clerk_id", "test@example.com")

    from app import auth
    from app.main import app

    app.dependency_overrides[auth.current_user] = lambda: test_user

    tc = TestClient(app)
    tc.test_user = test_user  # type: ignore[attr-defined]
    try:
        yield tc
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def two_clients(db_setup):
    from fastapi.testclient import TestClient

    alice = db_setup("alice_clerk", "alice@example.com")
    bob = db_setup("bob_clerk", "bob@example.com")

    from app import auth
    from app.main import app

    class UserClient(TestClient):
        def __init__(self, user: dict):
            super().__init__(app)
            self.user = user

        def request(self, *args, **kwargs):
            app.dependency_overrides[auth.current_user] = lambda u=self.user: u
            return super().request(*args, **kwargs)

    a = UserClient(alice)
    b = UserClient(bob)
    try:
        yield a, b
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def raw_client(db_setup):
    from fastapi.testclient import TestClient
    from app.main import app

    tc = TestClient(app)
    return tc
