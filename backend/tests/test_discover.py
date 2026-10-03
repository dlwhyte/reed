"""Discover: URL normalisation, date tolerance, ingest and clustering."""
from __future__ import annotations

import asyncio

import feedparser
import pytest

from app import cohere_client, db, discover


# ------------------------------------------------------------- url_key

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("https://www.example.com/a/b/", "https://example.com/a/b"),
        ("http://Example.com/a?utm_source=rss&id=7", "https://example.com/a?id=7"),
        ("https://example.com/a#section", "https://example.com/a"),
        ("https://example.com/a?fbclid=xyz", "https://example.com/a"),
        ("https://example.com/", "https://example.com/"),
    ],
)
def test_url_key_normalises(raw, expected):
    assert discover.url_key(raw) == expected


def test_url_key_collapses_tracking_variants():
    a = discover.url_key("https://www.site.com/post?utm_campaign=a&utm_medium=b")
    b = discover.url_key("http://site.com/post/")
    assert a == b


# --------------------------------------------------------- date parsing

@pytest.mark.parametrize(
    "raw",
    [
        "Oct 01, 2026 00:00:00-0500",   # CrowdStrike; feedparser cannot read this
        "Fri, 02 Oct 2026 13:00:00 GMT",
        "2026-10-02T13:00:00Z",
        "2026-10-02 13:00:00+00:00",
    ],
)
def test_parse_loose_handles_real_world_formats(raw):
    assert discover._parse_loose(raw) is not None


def test_parse_loose_rejects_garbage():
    assert discover._parse_loose("not a date") is None


def test_undated_entry_is_flagged_not_silently_stamped_now():
    """An item with no usable date must not masquerade as breaking news."""
    feed = feedparser.parse(
        """<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
           <item><title>No date here</title><link>https://x.test/1</link></item>
           </channel></rss>"""
    )
    _, dated = discover._entry_published(feed.entries[0])
    assert dated is False


def test_dated_entry_is_flagged_real():
    feed = feedparser.parse(
        """<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
           <item><title>Dated</title><link>https://x.test/2</link>
           <pubDate>Fri, 02 Oct 2026 13:00:00 GMT</pubDate></item>
           </channel></rss>"""
    )
    published, dated = discover._entry_published(feed.entries[0])
    assert dated is True
    assert published.startswith("2026-10-02")


# ------------------------------------------------------------ strip_html

def test_strip_html_removes_markup_and_entities():
    out = discover.strip_html("<p>Hello <b>there</b> &amp; welcome</p><script>bad()</script>")
    assert out == "Hello there & welcome"


def test_strip_html_truncates():
    assert len(discover.strip_html("x" * 5000, limit=100)) <= 101


# ---------------------------------------------------------------- ingest

RSS = """<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>
  <item><title>First post</title><link>https://ex.test/one?utm_source=rss</link>
        <pubDate>Fri, 02 Oct 2026 13:00:00 GMT</pubDate>
        <description>&lt;p&gt;Body one&lt;/p&gt;</description></item>
  <item><title>Second post</title><link>https://ex.test/two</link>
        <pubDate>Fri, 02 Oct 2026 14:00:00 GMT</pubDate>
        <description>Body two</description></item>
</channel></rss>"""


def _seed(db_setup) -> int:
    """Fresh user plus one feed; returns the user id."""
    user = db_setup("u", "u@x", "tok")
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO feeds (user_id, url, title, topic) VALUES (?,?,?,?)",
            (user["id"], "https://ex.test/feed", "Feed", "test"),
        )
    return user["id"]


def test_store_ingests_and_deduplicates(db_setup):
    from datetime import datetime, timezone

    uid = _seed(db_setup)
    parsed = feedparser.parse(RSS)
    cutoff = datetime(2026, 1, 1, tzinfo=timezone.utc)

    with db.connect() as conn:
        feed = dict(conn.execute("SELECT * FROM feeds WHERE user_id = ?", (uid,)).fetchone())
        assert discover._store(conn, uid, feed, parsed, cutoff) == 2
        # Re-ingesting the same feed adds nothing, even with tracking params.
        assert discover._store(conn, uid, feed, parsed, cutoff) == 0

        rows = conn.execute("SELECT url_key, excerpt FROM feed_items ORDER BY id").fetchall()
        assert rows[0]["url_key"] == "https://ex.test/one"
        assert rows[0]["excerpt"] == "Body one"


def test_store_respects_age_cutoff(db_setup):
    from datetime import datetime, timezone

    uid = _seed(db_setup)
    parsed = feedparser.parse(RSS)
    cutoff = datetime(2026, 12, 1, tzinfo=timezone.utc)  # everything is older

    with db.connect() as conn:
        feed = dict(conn.execute("SELECT * FROM feeds WHERE user_id = ?", (uid,)).fetchone())
        assert discover._store(conn, uid, feed, parsed, cutoff) == 0


# ------------------------------------------------------------ clustering

def test_cluster_groups_similar_and_splits_different(db_setup, monkeypatch):
    """Two near-identical vectors must share a cluster; an unrelated one must not."""
    titles = [
        "Fortinet warns of critical FortiMail flaw exploited in the wild",
        "Critical FortiMail zero-day under active exploitation, Fortinet says",
        "Toronto fire crews dismantle a Drake ice sculpture",
    ]
    vectors = [
        [1.0, 0.0, 0.0],
        [0.98, 0.20, 0.0],   # cosine ~0.98 against the first
        [0.0, 0.0, 1.0],     # orthogonal
    ]

    async def fake_embed(texts, **kwargs):
        return vectors[: len(texts)]

    monkeypatch.setattr(cohere_client, "embed", fake_embed)

    uid = _seed(db_setup)
    with db.connect() as conn:
        feed_id = conn.execute("SELECT id FROM feeds WHERE user_id = ?", (uid,)).fetchone()["id"]
        for n, t in enumerate(titles):
            conn.execute(
                """INSERT INTO feed_items (user_id, feed_id, url, url_key, title, published)
                   VALUES (?, ?, ?, ?, ?, '2026-10-03T12:00:00+00:00')""",
                (uid, feed_id, f"https://ex.test/{n}", f"https://ex.test/{n}", t),
            )

    result = asyncio.run(discover.cluster_new_items(uid))
    assert result["embedded"] == 3

    with db.connect() as conn:
        rows = {r["title"]: r["cluster_id"]
                for r in conn.execute("SELECT title, cluster_id FROM feed_items")}

    assert rows[titles[0]] == rows[titles[1]], "same story should share a cluster"
    assert rows[titles[2]] != rows[titles[0]], "unrelated story must not merge"


def test_cluster_is_noop_when_nothing_pending(db_setup):
    uid = _seed(db_setup)
    assert asyncio.run(discover.cluster_new_items(uid)) == {"embedded": 0, "clustered": 0}
