"""Seed a fresh SQLite DB at $DATA_DIR/reader.db with one fixture
article, so the Playwright smoke test has something to interact with
without having to mock the extractor or the Cohere client.

Invoked from playwright.config.ts before the backend web server launches.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_REPO_ROOT / "backend"))

from app import db  # noqa: E402

FIXTURE_CONTENT = (
    "The quick brown fox jumps over the lazy dog. "
    "This passage is here so that we can highlight something from it "
    "during the end-to-end test. "
    "Reading requires patience and attention, both of which this test "
    "will exercise in small doses."
)


def main() -> None:
    data_dir = Path(os.environ.get("DATA_DIR") or "")
    if not data_dir:
        raise SystemExit("DATA_DIR env var is required")
    data_dir.mkdir(parents=True, exist_ok=True)

    db_path = data_dir / "reader.db"
    # Start from scratch each run so the seed is idempotent.
    if db_path.exists():
        db_path.unlink()

    db.init_db()

    with db.connect() as conn:
        conn.execute(
            """INSERT INTO articles
               (url, title, author, site_name, content, excerpt,
                word_count, read_time_min, summary_short, summary_long, tags)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "https://example.com/fixture",
                "Fixture Article for E2E",
                "Test Author",
                "example.com",
                FIXTURE_CONTENT,
                FIXTURE_CONTENT[:200],
                len(FIXTURE_CONTENT.split()),
                1,
                "A fixture article seeded for Playwright.",
                "Seeded before the e2e suite runs so the smoke test has "
                "something deterministic to open and highlight.",
                json.dumps(["fixture", "e2e"]),
            ),
        )

    print(f"seeded {db_path}", flush=True)


if __name__ == "__main__":
    main()
