import sqlite3
import json
from contextlib import contextmanager
from .config import DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clerk_user_id TEXT UNIQUE NOT NULL,
    email TEXT,
    bookmarklet_token TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    author TEXT,
    site_name TEXT,
    published TEXT,
    content TEXT,
    excerpt TEXT,
    image_url TEXT,
    word_count INTEGER DEFAULT 0,
    read_time_min INTEGER DEFAULT 0,
    summary_short TEXT,
    summary_long TEXT,
    tags TEXT DEFAULT '[]',
    embedding BLOB,
    is_archived INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    progress REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT,
    UNIQUE (user_id, url),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_articles_user ON articles(user_id);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
    title, content, excerpt, tags, user_id UNINDEXED, tokenize='porter'
);

CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
    INSERT INTO articles_fts(rowid, title, content, excerpt, tags, user_id)
    VALUES (new.id, new.title, new.content, new.excerpt, new.tags, new.user_id);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
    UPDATE articles_fts SET title=new.title, content=new.content,
        excerpt=new.excerpt, tags=new.tags, user_id=new.user_id WHERE rowid=new.id;
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
    DELETE FROM articles_fts WHERE rowid=old.id;
END;

CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_article ON highlights(article_id);

CREATE TABLE IF NOT EXISTS cohere_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ts TEXT DEFAULT CURRENT_TIMESTAMP,
    endpoint TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cohere_usage_ts ON cohere_usage(ts);
CREATE INDEX IF NOT EXISTS idx_cohere_usage_endpoint ON cohere_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_cohere_usage_user ON cohere_usage(user_id);

CREATE TABLE IF NOT EXISTS auth_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT DEFAULT CURRENT_TIMESTAMP,
    event TEXT NOT NULL,
    ip TEXT,
    user_id INTEGER,
    detail TEXT,
    path TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_events_ts ON auth_events(ts);
CREATE INDEX IF NOT EXISTS idx_auth_events_event ON auth_events(event);

CREATE TABLE IF NOT EXISTS api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    prefix TEXT NOT NULL,
    last_used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
"""


def _needs_wipe(conn: sqlite3.Connection) -> bool:
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='articles'"
    )
    if cur.fetchone() is None:
        return False
    cols = {row[1] for row in conn.execute("PRAGMA table_info(articles)")}
    return "user_id" not in cols


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _migrate(conn: sqlite3.Connection) -> None:
    """Non-destructive column adds for tables that already exist with the
    older shape. CREATE TABLE IF NOT EXISTS won't add a missing column."""
    if "users" in {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}:
        if "tier" not in _table_columns(conn, "users"):
            conn.execute(
                "ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'"
            )


def init_db():
    with connect() as conn:
        if _needs_wipe(conn):
            conn.executescript(
                """
                DROP TABLE IF EXISTS articles_fts;
                DROP TABLE IF EXISTS highlights;
                DROP TABLE IF EXISTS cohere_usage;
                DROP TABLE IF EXISTS articles;
                """
            )
        conn.executescript(SCHEMA)
        _migrate(conn)


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


def row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if "tags" in d and isinstance(d["tags"], str):
        try:
            d["tags"] = json.loads(d["tags"])
        except Exception:
            d["tags"] = []
    d.pop("embedding", None)
    d.pop("content", None)
    return d


def row_to_full_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if "tags" in d and isinstance(d["tags"], str):
        try:
            d["tags"] = json.loads(d["tags"])
        except Exception:
            d["tags"] = []
    d.pop("embedding", None)
    return d
