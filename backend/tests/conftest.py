"""Shared pytest fixtures.

We rewire the backend to use an isolated temp directory and disable the
LLM path *before* importing any app modules, so `config.py`'s
`load_dotenv(...)` + module-level constants capture the test values.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

# Locate the backend root and put it on sys.path so `import app.main` works
# when pytest is invoked from anywhere.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

# Force a fresh, isolated data directory and disable the LLM integration
# before config.py loads. Real tests should never touch ~/ReaderData or
# call Cohere.
_TMP_DATA_DIR = tempfile.mkdtemp(prefix="reed-tests-")
os.environ["DATA_DIR"] = _TMP_DATA_DIR
os.environ["ENABLE_LLM"] = "false"
os.environ["COHERE_API_KEY"] = ""
os.environ["TAVILY_API_KEY"] = ""
# Tests simulate article fetches against local fakes, which live on
# loopback / RFC1918 — allow that explicitly.
os.environ["READER_ALLOW_PRIVATE_URLS"] = "true"


@pytest.fixture
def db_setup(monkeypatch):
    """Set up a fresh, isolated SQLite for one test and return a helper
    that seeds users into it. Composed by `client`, `two_clients`, and
    `raw_client` so they share schema setup but choose how to authenticate.
    """
    from app import config, db

    db_dir = tempfile.mkdtemp(prefix="reed-tests-db-")
    test_path = Path(db_dir) / "reader.db"
    monkeypatch.setattr(config, "DB_PATH", test_path)
    monkeypatch.setattr(db, "DB_PATH", test_path)

    db.init_db()

    def seed_user(clerk_id: str, email: str, bookmarklet_token: str) -> dict:
        with db.connect() as conn:
            cur = conn.execute(
                "INSERT INTO users (clerk_user_id, email, bookmarklet_token) "
                "VALUES (?, ?, ?)",
                (clerk_id, email, bookmarklet_token),
            )
            return {
                "id": cur.lastrowid,
                "clerk_user_id": clerk_id,
                "email": email,
                "bookmarklet_token": bookmarklet_token,
            }

    return seed_user


@pytest.fixture
def client(db_setup):
    """FastAPI TestClient with a clean SQLite + a single seeded test user.

    Bypasses Clerk JWT verification by overriding the `current_user` /
    `current_user_or_bookmarklet` deps with a function that returns the
    seeded row. Real auth-required behavior is exercised by `raw_client`.
    """
    from fastapi.testclient import TestClient

    test_user = db_setup(
        "test_user_clerk_id", "test@example.com", "test-bookmarklet-token"
    )

    from app import auth
    from app.main import app

    app.dependency_overrides[auth.current_user] = lambda: test_user
    app.dependency_overrides[auth.current_user_or_bookmarklet] = lambda: test_user

    tc = TestClient(app)
    tc.test_user = test_user  # type: ignore[attr-defined]
    try:
        yield tc
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def two_clients(db_setup):
    """Two TestClients, each impersonating a different user, sharing a
    single fresh DB. Used to verify cross-user data isolation.

    Yields (alice_client, bob_client). Each client routes its requests
    through a per-request dep override so the two never see each other's
    rows.
    """
    from fastapi.testclient import TestClient

    alice = db_setup("alice_clerk", "alice@example.com", "alice-bookmarklet")
    bob = db_setup("bob_clerk", "bob@example.com", "bob-bookmarklet")

    from app import auth
    from app.main import app

    class UserClient(TestClient):
        def __init__(self, user: dict):
            super().__init__(app)
            self.user = user

        def request(self, *args, **kwargs):
            # Re-bind the override on every request so two interleaved
            # clients don't trample each other.
            app.dependency_overrides[auth.current_user] = lambda u=self.user: u
            app.dependency_overrides[auth.current_user_or_bookmarklet] = lambda u=self.user: u
            return super().request(*args, **kwargs)

    a = UserClient(alice)
    b = UserClient(bob)
    try:
        yield a, b
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def raw_client(db_setup):
    """TestClient with NO auth overrides. Use to verify that endpoints
    require authentication (the real `current_user` dep runs and rejects
    requests without a Bearer header).
    """
    from fastapi.testclient import TestClient
    from app.main import app

    # Seed a user so the bookmarklet-token branch has something to find.
    seeded = db_setup("raw_clerk", "raw@example.com", "raw-bookmarklet-token")

    tc = TestClient(app)
    tc.seeded_user = seeded  # type: ignore[attr-defined]
    return tc


@pytest.fixture
def fake_article(monkeypatch):
    """Replace the live network + trafilatura path with a canned article."""
    from app import extractor, main

    async def _fetch(url: str) -> str:
        return "<html><head><title>Fake</title></head><body>x</body></html>"

    def _extract(html: str, url: str) -> dict:
        return {
            "title": "A Canned Test Article",
            "author": "Test Author",
            "site_name": "example.com",
            "published": "2026-04-21",
            "content": "Hello world. " * 50,
            "excerpt": "Hello world. Hello world.",
            "image_url": None,
            "word_count": 100,
            "read_time_min": 1,
        }

    monkeypatch.setattr(extractor, "fetch_html", _fetch)
    monkeypatch.setattr(extractor, "extract", _extract)
    # `main` imports `extractor` as a module attribute, so patching the
    # attributes on the module covers both call sites.
    monkeypatch.setattr(main.extractor, "fetch_html", _fetch, raising=False)
    monkeypatch.setattr(main.extractor, "extract", _extract, raising=False)
