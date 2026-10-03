"""Discover ranking: profile, scoring, decay and the daily brief."""
from __future__ import annotations

import asyncio
import json

from app import cohere_client, db, discover_rank as R


async def _no_sleep(*_args, **_kwargs):
    """Stub for asyncio.sleep. Must not call asyncio.sleep itself — patching the
    module attribute makes that infinitely recursive."""
    return None


def _user(db_setup, feeds: int = 1) -> int:
    user = db_setup("u", "u@x", "tok")
    with db.connect() as conn:
        for n in range(feeds):
            conn.execute(
                "INSERT INTO feeds (user_id, url, title, topic, weight) VALUES (?,?,?,?,?)",
                (user["id"], f"https://f{n}.test/rss", f"Feed {n}", "security", 1.0),
            )
    return user["id"]


def _item(uid: int, feed_id: int, n: int, *, hours_old: float = 1.0,
          score: int | None = None, cluster: int | None = None) -> int:
    with db.connect() as conn:
        cur = conn.execute(
            f"""INSERT INTO feed_items
                  (user_id, feed_id, url, url_key, title, excerpt, published, score, scored_at, cluster_id)
                VALUES (?,?,?,?,?,?, datetime('now', '-{hours_old} hours'), ?, ?, ?)""",
            (uid, feed_id, f"https://f.test/{n}", f"https://f.test/{n}",
             f"Item {n}", f"Body {n}", score,
             "2026-10-03T00:00:00" if score is not None else None, cluster),
        )
        return cur.lastrowid


# ------------------------------------------------------------------ profile

def test_profile_defaults_when_unset(db_setup):
    uid = _user(db_setup)
    p = R.load_profile(uid)
    assert p["half_life_hours"] == 72
    assert p["hide_below"] == 25
    assert p["interests"] == []


def test_profile_round_trips(db_setup):
    uid = _user(db_setup)
    R.save_profile(uid, role="Security lead", interests=["prompt injection"],
                   mute=["funding rounds"], hide_below=40)
    p = R.load_profile(uid)
    assert p["role"] == "Security lead"
    assert p["interests"] == ["prompt injection"]
    assert p["mute"] == ["funding rounds"]
    assert p["hide_below"] == 40
    assert p["half_life_hours"] == 72, "unspecified fields keep their default"


# ------------------------------------------------------------------ ranking

def test_rank_decays_with_age(db_setup):
    """A fresh middling item should beat a stale excellent one eventually."""
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    _item(uid, fid, 1, hours_old=0.5, score=60)
    _item(uid, fid, 2, hours_old=90, score=95)   # old, but inside the 96h window

    ranked = R.ranked_items(uid)
    assert len(ranked) == 2
    assert ranked[0]["title"] == "Item 1", "a 90-hour-old 95 should not outrank a fresh 60"
    assert ranked[0]["rank_score"] > ranked[1]["rank_score"]


def test_rank_hides_below_floor(db_setup):
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    _item(uid, fid, 1, score=80)
    _item(uid, fid, 2, score=5)
    titles = [r["title"] for r in R.ranked_items(uid)]
    assert titles == ["Item 1"]


def test_rank_shows_one_row_per_cluster(db_setup):
    uid = _user(db_setup, feeds=2)
    with db.connect() as conn:
        fids = [r["id"] for r in conn.execute(
            "SELECT id FROM feeds WHERE user_id=? ORDER BY id", (uid,))]
    a = _item(uid, fids[0], 1, score=70)
    with db.connect() as conn:
        conn.execute("UPDATE feed_items SET cluster_id = ? WHERE id = ?", (a, a))
    b = _item(uid, fids[1], 2, score=60, cluster=a)

    ranked = R.ranked_items(uid)
    assert len(ranked) == 1, "a cluster collapses to one row"
    assert ranked[0]["cluster_size"] == 2


def test_rank_excludes_dismissed(db_setup):
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    i = _item(uid, fid, 1, score=90)
    with db.connect() as conn:
        conn.execute("UPDATE feed_items SET dismissed_at = datetime('now') WHERE id = ?", (i,))
    assert R.ranked_items(uid) == []


def test_rank_is_per_user(db_setup):
    """One user's feed must never leak into another's."""
    alice = _user(db_setup)
    bob = db_setup("b", "b@x", "tok-b")["id"]
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (alice,)).fetchone()["id"]
    _item(alice, fid, 1, score=90)
    assert len(R.ranked_items(alice)) == 1
    assert R.ranked_items(bob) == []


# ------------------------------------------------------------------ scoring

def test_score_pending_writes_scores(db_setup, monkeypatch):
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    for n in range(3):
        _item(uid, fid, n)

    async def fake_complete(prompt, **kwargs):
        return json.dumps({"scores": [
            {"n": 1, "score": 90, "reason": "exploited in the wild", "tags": ["cve"]},
            {"n": 2, "score": 10, "reason": "vendor marketing", "tags": ["pr"]},
            {"n": 3, "score": 55, "reason": "useful background", "tags": []},
        ]})

    monkeypatch.setattr(cohere_client, "complete", fake_complete)
    result = asyncio.run(R.score_pending(uid))

    assert result["scored"] == 3 and result["failed"] == 0
    with db.connect() as conn:
        rows = {r["title"]: r for r in conn.execute(
            "SELECT title, score, score_reason, score_tags FROM feed_items ORDER BY id")}
    assert rows["Item 0"]["score"] == 90
    assert rows["Item 0"]["score_reason"] == "exploited in the wild"
    assert json.loads(rows["Item 0"]["score_tags"]) == ["cve"]
    assert rows["Item 1"]["score"] == 10


def test_score_clamps_out_of_range_values(db_setup, monkeypatch):
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    _item(uid, fid, 1)

    async def fake_complete(prompt, **kwargs):
        return json.dumps({"scores": [{"n": 1, "score": 9999, "reason": "x"}]})

    monkeypatch.setattr(cohere_client, "complete", fake_complete)
    asyncio.run(R.score_pending(uid))
    with db.connect() as conn:
        assert conn.execute("SELECT score FROM feed_items").fetchone()["score"] == 100


def test_score_retries_then_reports_the_error(db_setup, monkeypatch):
    """A failing batch must surface why, not look like a healthy empty run."""
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    _item(uid, fid, 1)

    attempts = {"n": 0}

    async def flaky(prompt, **kwargs):
        attempts["n"] += 1
        raise RuntimeError("429 rate limited")

    monkeypatch.setattr(cohere_client, "complete", flaky)
    monkeypatch.setattr(R.asyncio, "sleep", _no_sleep)

    result = asyncio.run(R.score_pending(uid))
    assert attempts["n"] == R.SCORE_ATTEMPTS, "should retry transient failures"
    assert result["scored"] == 0 and result["failed"] == 1
    assert "429" in result["errors"][0]


def test_score_recovers_on_a_later_attempt(db_setup, monkeypatch):
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    _item(uid, fid, 1)

    calls = {"n": 0}

    async def flaky(prompt, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("429 rate limited")
        return json.dumps({"scores": [{"n": 1, "score": 70, "reason": "ok"}]})

    monkeypatch.setattr(cohere_client, "complete", flaky)
    monkeypatch.setattr(R.asyncio, "sleep", _no_sleep)

    result = asyncio.run(R.score_pending(uid))
    assert result["scored"] == 1 and result["failed"] == 0


# ------------------------------------------------------------------- digest

def test_digest_quiet_day_needs_no_model(db_setup):
    uid = _user(db_setup)
    out = asyncio.run(R.build_digest(uid, force=True))
    assert out["model"] == "none" and out["item_count"] == 0
    assert "Quiet day" in out["markdown"]


def test_digest_is_cached_until_forced(db_setup, monkeypatch):
    uid = _user(db_setup)
    with db.connect() as conn:
        fid = conn.execute("SELECT id FROM feeds WHERE user_id=?", (uid,)).fetchone()["id"]
    _item(uid, fid, 1, score=90)

    calls = {"n": 0}

    async def fake_complete(prompt, **kwargs):
        calls["n"] += 1
        return "## The one thing\n\nSomething happened."

    monkeypatch.setattr(cohere_client, "complete", fake_complete)

    first = asyncio.run(R.build_digest(uid, force=True))
    assert calls["n"] == 1 and first["item_count"] == 1

    again = asyncio.run(R.build_digest(uid))
    assert calls["n"] == 1, "a second call the same day should reuse the stored brief"
    assert again.get("cached") is True

    asyncio.run(R.build_digest(uid, force=True))
    assert calls["n"] == 2, "force must regenerate"
