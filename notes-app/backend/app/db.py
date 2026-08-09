from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from .config import DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clerk_user_id TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT,
    body TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'default',
    is_pinned INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title, body, user_id UNINDEXED, tokenize='porter'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, body, user_id)
    VALUES (new.id, new.title, new.body, new.user_id);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    UPDATE notes_fts SET title=new.title, body=new.body, user_id=new.user_id
        WHERE rowid=new.id;
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE rowid=old.id;
END;

CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    parent_id INTEGER,
    color TEXT NOT NULL DEFAULT 'default',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES labels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_labels_user ON labels(user_id);

-- SQLite treats NULL != NULL in a plain UNIQUE(...), so a table-level
-- constraint on (user_id, parent_id, name) would let unlimited duplicate
-- top-level (parent_id IS NULL) names through. Two partial indexes instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_unique_nested
    ON labels(user_id, parent_id, name) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_unique_top
    ON labels(user_id, name) WHERE parent_id IS NULL;

CREATE TABLE IF NOT EXISTS note_labels (
    note_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, label_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    label_ids TEXT NOT NULL DEFAULT '[]',
    search_text TEXT,
    archived_filter TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
"""


def init_db():
    with connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_note_dict(row: sqlite3.Row, label_ids: list[int] | None = None) -> dict:
    d = dict(row)
    d["label_ids"] = label_ids or []
    return d
