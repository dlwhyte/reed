"""Discover: subscribe to feeds, poll them, cluster the results.

A feed_item is deliberately not an article. It holds only what the feed gave
us, so polling a few hundred a day is nearly free. Promotion into `articles`
(full extraction, summary, embedding) happens on save, in main.py.
"""
from __future__ import annotations

import asyncio
import json
import re
from email.utils import parsedate_to_datetime
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

import feedparser
import httpx

from . import cohere_client
from .db import connect

USER_AGENT = "BrowseFellow/1.0 Discover (+https://browsefellow.com)"
FETCH_TIMEOUT = 25.0
FETCH_CONCURRENCY = 8

# Several feeds serve their whole archive; without this the first poll would
# queue thousands of years-old items.
DEFAULT_MAX_AGE_DAYS = 10

# Two items belong to the same story at or above this cosine similarity.
CLUSTER_THRESHOLD = 0.82
CLUSTER_WINDOW_HOURS = 72

_TRACKING = re.compile(
    r"^(utm_|ref$|refsrc$|fbclid$|gclid$|mc_cid$|mc_eid$|at_|cmp$|source$|__twitter)", re.I
)


# --------------------------------------------------------------------- utils

def url_key(raw: str) -> str:
    """Collapse the same article arriving with different tracking junk."""
    try:
        u = urlparse(raw.strip())
        host = (u.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if u.port:
            host = f"{host}:{u.port}"
        query = urlencode([(k, v) for k, v in parse_qsl(u.query) if not _TRACKING.match(k)])
        path = u.path.rstrip("/") if len(u.path) > 1 else u.path
        return urlunparse(("https", host, path, "", query, ""))
    except Exception:
        return raw.strip()


def strip_html(html: str | None, limit: int = 1200) -> str:
    if not html:
        return ""
    text = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                 ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")):
        text = text.replace(a, b)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] + "…" if len(text) > limit else text


# Formats feedparser does not handle, seen in the wild.
# e.g. CrowdStrike serves "Oct 01, 2026 00:00:00-0500".
_DATE_FORMATS = (
    "%b %d, %Y %H:%M:%S%z",
    "%b %d, %Y %H:%M:%S",
    "%B %d, %Y %H:%M:%S%z",
    "%Y-%m-%d %H:%M:%S%z",
    "%Y-%m-%d",
)


def _parse_loose(raw: str) -> datetime | None:
    raw = raw.strip()
    try:
        return parsedate_to_datetime(raw)
    except Exception:
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        pass
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _entry_published(entry: Any) -> tuple[str, bool]:
    """Returns (iso timestamp, is_real). Falls back to now() only as a last
    resort; an undated item must not masquerade as breaking news, so callers
    get told whether the date was genuine."""
    for attr in ("published_parsed", "updated_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat(), True
            except Exception:
                pass

    for attr in ("published", "updated", "created", "date"):
        raw = _first(getattr(entry, attr, None))
        if not raw:
            continue
        dt = _parse_loose(raw)
        if dt:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat(), True

    return datetime.now(timezone.utc).isoformat(), False


def _entry_text(entry: Any) -> str:
    if getattr(entry, "content", None):
        return entry.content[0].get("value", "")
    return getattr(entry, "summary", "") or getattr(entry, "description", "") or ""


def _first(value: Any) -> str | None:
    """Feeds hand back dicts and lists where a string is expected."""
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, (list, tuple)):
        return _first(value[0]) if value else None
    if isinstance(value, dict):
        for k in ("name", "value", "href", "term"):
            if value.get(k):
                return _first(value[k])
    return None


# ------------------------------------------------------------------- feeds

def list_feeds(user_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """SELECT f.*, (SELECT COUNT(*) FROM feed_items i WHERE i.feed_id = f.id) AS item_count
                 FROM feeds f WHERE f.user_id = ? ORDER BY f.topic, f.title""",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def add_feeds(user_id: int, feeds: Iterable[dict]) -> dict:
    added = skipped = 0
    with connect() as conn:
        for f in feeds:
            url = (f.get("url") or "").strip()
            if not url:
                continue
            exists = conn.execute(
                "SELECT 1 FROM feeds WHERE user_id = ? AND url = ?", (user_id, url)
            ).fetchone()
            if exists:
                skipped += 1
                continue
            conn.execute(
                """INSERT INTO feeds (user_id, url, title, site_url, topic, weight)
                   VALUES (?,?,?,?,?,?)""",
                (user_id, url, f.get("title") or url, f.get("site_url"),
                 f.get("topic") or "general", float(f.get("weight") or 1.0)),
            )
            added += 1
    return {"added": added, "skipped": skipped}


def remove_feed(user_id: int, feed_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM feeds WHERE user_id = ? AND id = ?", (user_id, feed_id))


def update_feed(user_id: int, feed_id: int, **fields) -> None:
    allowed = {"active", "topic", "weight", "title"}
    sets = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not sets:
        return
    clause = ", ".join(f"{k} = ?" for k in sets)
    with connect() as conn:
        conn.execute(
            f"UPDATE feeds SET {clause} WHERE user_id = ? AND id = ?",
            (*sets.values(), user_id, feed_id),
        )


# ------------------------------------------------------------------ polling

async def _fetch_one(client: httpx.AsyncClient, feed: dict) -> tuple[dict, Any, str]:
    headers = {"User-Agent": USER_AGENT}
    if feed.get("etag"):
        headers["If-None-Match"] = feed["etag"]
    if feed.get("last_modified"):
        headers["If-Modified-Since"] = feed["last_modified"]

    res = await client.get(feed["url"], headers=headers, follow_redirects=True)
    if res.status_code == 304:
        return feed, None, "304"
    res.raise_for_status()
    return feed, feedparser.parse(res.content), str(res.status_code)


def _store(conn, user_id: int, feed: dict, parsed: Any, cutoff: datetime) -> int:
    added = 0
    for entry in getattr(parsed, "entries", []) or []:
        link = _first(getattr(entry, "link", None)) or _first(getattr(entry, "id", None))
        title = _first(getattr(entry, "title", None))
        if not link or not title:
            continue

        published, dated = _entry_published(entry)
        if dated:
            try:
                if datetime.fromisoformat(published) < cutoff:
                    continue
            except ValueError:
                pass

        key = url_key(link)
        if conn.execute(
            "SELECT 1 FROM feed_items WHERE user_id = ? AND url_key = ?", (user_id, key)
        ).fetchone():
            continue

        conn.execute(
            """INSERT OR IGNORE INTO feed_items
                 (user_id, feed_id, url, url_key, title, author, excerpt, published)
               VALUES (?,?,?,?,?,?,?,?)""",
            (user_id, feed["id"], link, key, title,
             _first(getattr(entry, "author", None)),
             strip_html(_entry_text(entry)), published),
        )
        added += 1
    return added


async def poll_feeds(user_id: int, max_age_days: int = DEFAULT_MAX_AGE_DAYS) -> dict:
    """Fetch every active feed for a user. Returns counts; never raises per-feed."""
    with connect() as conn:
        feeds = [dict(r) for r in conn.execute(
            "SELECT * FROM feeds WHERE user_id = ? AND active = 1 ORDER BY id", (user_id,)
        ).fetchall()]
    if not feeds:
        return {"feeds": 0, "added": 0, "failed": 0}

    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    sem = asyncio.Semaphore(FETCH_CONCURRENCY)
    added_total = 0
    failed = 0

    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT) as client:
        async def run(feed: dict):
            nonlocal added_total, failed
            async with sem:
                try:
                    feed, parsed, status = await _fetch_one(client, feed)
                except Exception as exc:  # noqa: BLE001 - one bad feed must not stop the poll
                    failed += 1
                    with connect() as conn:
                        conn.execute(
                            """UPDATE feeds SET last_fetched_at = datetime('now'),
                                 last_status = 'error', last_error = ? WHERE id = ?""",
                            (str(exc)[:300], feed["id"]),
                        )
                    return

                with connect() as conn:
                    if parsed is not None:
                        chan = getattr(parsed, "feed", None)
                        conn.execute(
                            """UPDATE feeds SET
                                 title = COALESCE(NULLIF(title, ''), ?),
                                 site_url = COALESCE(site_url, ?)
                               WHERE id = ?""",
                            (_first(getattr(chan, "title", None)) or feed["url"],
                             _first(getattr(chan, "link", None)), feed["id"]),
                        )
                        added_total += _store(conn, user_id, feed, parsed, cutoff)
                    conn.execute(
                        """UPDATE feeds SET last_fetched_at = datetime('now'),
                             last_status = ?, last_error = NULL WHERE id = ?""",
                        (status, feed["id"]),
                    )

        await asyncio.gather(*(run(f) for f in feeds))

    return {"feeds": len(feeds), "added": added_total, "failed": failed}


# --------------------------------------------------------------- clustering

async def cluster_new_items(user_id: int, limit: int = 300) -> dict:
    """Embed unembedded items and group each with its nearest recent neighbour.

    Uses Cohere embeddings rather than title-word overlap, so two outlets
    writing different headlines about the same story still merge.
    """
    with connect() as conn:
        pending = [dict(r) for r in conn.execute(
            """SELECT id, feed_id, title, excerpt FROM feed_items
                WHERE user_id = ? AND embedding IS NULL
                ORDER BY published DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()]
    if not pending:
        return {"embedded": 0, "clustered": 0}

    texts = [f"{p['title']}\n{(p['excerpt'] or '')[:500]}" for p in pending]
    vectors = await cohere_client.embed(
        texts, input_type="search_document", endpoint="discover_cluster", user_id=user_id
    )

    with connect() as conn:
        recent = [
            (r["id"], r["feed_id"], r["cluster_id"],
             cohere_client.blob_to_embedding(r["embedding"]))
            for r in conn.execute(
                """SELECT id, feed_id, cluster_id, embedding FROM feed_items
                    WHERE user_id = ? AND embedding IS NOT NULL
                      AND published > datetime('now', ?)""",
                (user_id, f"-{CLUSTER_WINDOW_HOURS} hours"),
            ).fetchall()
            if r["embedding"]
        ]

        embedded = clustered = 0
        for item, vec in zip(pending, vectors):
            if not vec:
                continue
            blob = cohere_client.embedding_to_blob(vec)

            best_id, best_score = None, 0.0
            for other_id, other_feed, other_cluster, other_vec in recent:
                # Only ever merge ACROSS sources. Feeds with templated titles
                # (CISA KEV, SANS Stormcast) otherwise collapse genuinely
                # distinct advisories into one row, and hiding an actively
                # exploited CVE costs far more than showing a near-duplicate.
                if other_feed == item["feed_id"] or not other_vec:
                    continue
                score = cohere_client.cosine(vec, other_vec)
                if score > best_score:
                    best_score, best_id = score, other_cluster or other_id

            cluster_id = best_id if best_score >= CLUSTER_THRESHOLD else item["id"]
            if best_score >= CLUSTER_THRESHOLD:
                clustered += 1

            conn.execute(
                "UPDATE feed_items SET embedding = ?, cluster_id = ? WHERE id = ?",
                (blob, cluster_id, item["id"]),
            )
            recent.append((item["id"], item["feed_id"], cluster_id, vec))
            embedded += 1

    return {"embedded": embedded, "clustered": clustered}
