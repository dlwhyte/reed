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
def client(monkeypatch):
    """FastAPI TestClient with a clean SQLite per test."""
    from fastapi.testclient import TestClient

    # Isolate this test's DB so state doesn't leak between tests. `db.py`
    # imports DB_PATH at module load, so we have to patch it on both
    # modules to keep them in sync.
    from app import config, db

    db_dir = tempfile.mkdtemp(prefix="reed-tests-db-")
    test_path = Path(db_dir) / "reader.db"
    monkeypatch.setattr(config, "DB_PATH", test_path)
    monkeypatch.setattr(db, "DB_PATH", test_path)

    # Re-init schema against the fresh DB.
    db.init_db()

    from app.main import app

    return TestClient(app)


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
