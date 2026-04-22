"""Security-focused tests covering OWASP A01 (Broken Access Control),
A07 (Identification & Authentication Failures), and the bookmarklet-token
auth surface.

These complement test_api.py — that file exercises the happy path with a
single seeded user; this file makes sure user A can't see/modify user B's
data, that endpoints actually require authentication, and that the
bookmarklet token is honored on the right endpoints and rejected on the
rest.
"""
from __future__ import annotations


# --- A01 — Broken Access Control: cross-user isolation ----------------------


def _save_for(client, fake_article, url: str) -> int:
    """Helper: save an article via the given client, return its id."""
    r = client.post("/api/save", json={"url": url})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_alice_cannot_read_bobs_article(two_clients, fake_article):
    alice, bob = two_clients
    bob_aid = _save_for(bob, fake_article, "https://example.com/bob-private")

    r = alice.get(f"/api/articles/{bob_aid}")
    assert r.status_code == 404, "Alice must get 404, not 403, to avoid id-enumeration"


def test_alice_cannot_patch_bobs_article(two_clients, fake_article):
    alice, bob = two_clients
    bob_aid = _save_for(bob, fake_article, "https://example.com/bob-patch")

    r = alice.patch(f"/api/articles/{bob_aid}", json={"is_archived": True})
    assert r.status_code == 404

    # Bob's article remains unchanged.
    a = bob.get(f"/api/articles/{bob_aid}").json()
    assert a["is_archived"] == 0


def test_alice_cannot_delete_bobs_article(two_clients, fake_article):
    alice, bob = two_clients
    bob_aid = _save_for(bob, fake_article, "https://example.com/bob-delete")

    r = alice.delete(f"/api/articles/{bob_aid}")
    assert r.status_code == 404

    # Article still exists for Bob.
    assert bob.get(f"/api/articles/{bob_aid}").status_code == 200


def test_articles_list_is_per_user(two_clients, fake_article):
    alice, bob = two_clients
    _save_for(alice, fake_article, "https://example.com/alice-1")
    _save_for(alice, fake_article, "https://example.com/alice-2")
    bob_aid = _save_for(bob, fake_article, "https://example.com/bob-1")

    alice_ids = {a["id"] for a in alice.get("/api/articles").json()}
    bob_ids = {a["id"] for a in bob.get("/api/articles").json()}

    assert bob_aid in bob_ids
    assert bob_aid not in alice_ids
    assert len(alice_ids) == 2
    assert len(bob_ids) == 1


def test_search_results_are_per_user(two_clients, fake_article):
    alice, bob = two_clients
    _save_for(alice, fake_article, "https://example.com/alice-search")
    _save_for(bob, fake_article, "https://example.com/bob-search")

    # Both articles share the same canned title from fake_article — but
    # FTS results must still scope to the caller's user_id.
    alice_hits = alice.get("/api/search?q=Canned").json()
    bob_hits = bob.get("/api/search?q=Canned").json()

    alice_urls = {a["url"] for a in alice_hits}
    bob_urls = {a["url"] for a in bob_hits}

    assert alice_urls == {"https://example.com/alice-search"}
    assert bob_urls == {"https://example.com/bob-search"}


def test_alice_cannot_see_bobs_highlights(two_clients, fake_article):
    alice, bob = two_clients
    bob_aid = _save_for(bob, fake_article, "https://example.com/bob-hl")
    bob.post(
        f"/api/articles/{bob_aid}/highlights",
        json={"text": "secret highlight", "note": None},
    )

    # The article itself isn't visible to Alice, so per-article highlights
    # endpoint returns nothing for her.
    r = alice.get(f"/api/articles/{bob_aid}/highlights")
    assert r.status_code == 200
    assert r.json() == []

    # Global highlights endpoint also scoped per-user.
    assert alice.get("/api/highlights").json() == []
    assert len(bob.get("/api/highlights").json()) == 1


def test_alice_cannot_delete_bobs_highlight(two_clients, fake_article):
    alice, bob = two_clients
    bob_aid = _save_for(bob, fake_article, "https://example.com/bob-hl-del")
    h = bob.post(
        f"/api/articles/{bob_aid}/highlights",
        json={"text": "another secret"},
    ).json()

    r = alice.delete(f"/api/highlights/{h['id']}")
    assert r.status_code == 404

    # Highlight still exists for Bob.
    assert len(bob.get("/api/highlights").json()) == 1


def test_tags_are_per_user(two_clients, fake_article, monkeypatch):
    """Saving an article with LLM off produces no AI tags, but a user
    can still apply manual tags via PATCH. Each user only sees their own.
    """
    alice, bob = two_clients
    a_aid = _save_for(alice, fake_article, "https://example.com/alice-tag")
    b_aid = _save_for(bob, fake_article, "https://example.com/bob-tag")

    alice.patch(f"/api/articles/{a_aid}", json={"tags": ["alice-only"]})
    bob.patch(f"/api/articles/{b_aid}", json={"tags": ["bob-only"]})

    alice_tags = {t["tag"] for t in alice.get("/api/tags").json()}
    bob_tags = {t["tag"] for t in bob.get("/api/tags").json()}

    assert "alice-only" in alice_tags and "bob-only" not in alice_tags
    assert "bob-only" in bob_tags and "alice-only" not in bob_tags


def test_usage_rollups_are_per_user(two_clients):
    from app import cohere_client

    alice, bob = two_clients
    aid = alice.test_user["id"] if hasattr(alice, "test_user") else alice.user["id"]
    bid = bob.user["id"]

    cohere_client.record_usage("chat", "command-a-03-2025", 1000, 100, user_id=aid)
    cohere_client.record_usage("chat", "command-a-03-2025", 5000, 500, user_id=bid)

    alice_usage = alice.get("/api/usage").json()["all_time"]
    bob_usage = bob.get("/api/usage").json()["all_time"]

    assert alice_usage["input_tokens"] == 1000
    assert alice_usage["output_tokens"] == 100
    assert bob_usage["input_tokens"] == 5000
    assert bob_usage["output_tokens"] == 500


# --- A07 — Authentication required on protected endpoints --------------------


def test_protected_endpoints_require_auth(raw_client):
    """Every /api/* endpoint that handles user data must reject requests
    with no Authorization header. The two intentionally-public endpoints
    (/api/health and /api/config) stay 200.
    """
    public = [
        ("GET", "/api/health"),
        ("GET", "/api/config"),
    ]
    protected = [
        ("GET", "/api/me"),
        ("POST", "/api/me/regenerate-bookmarklet-token"),
        ("GET", "/api/articles"),
        ("GET", "/api/articles/1"),
        ("PATCH", "/api/articles/1"),
        ("DELETE", "/api/articles/1"),
        ("GET", "/api/search?q=x"),
        ("GET", "/api/articles/1/similar"),
        ("GET", "/api/tags"),
        ("GET", "/api/articles/1/highlights"),
        ("POST", "/api/articles/1/highlights"),
        ("DELETE", "/api/highlights/1"),
        ("GET", "/api/highlights"),
        ("GET", "/api/usage"),
    ]

    for method, path in public:
        r = raw_client.request(method, path)
        assert r.status_code == 200, f"{method} {path} should be public, got {r.status_code}"

    for method, path in protected:
        r = raw_client.request(method, path, json={} if method in ("POST", "PATCH") else None)
        assert r.status_code == 401, f"{method} {path} should require auth, got {r.status_code}: {r.text[:120]}"


def test_protected_endpoints_reject_malformed_bearer(raw_client):
    """A bearer header without a token should also 401, not crash."""
    r = raw_client.get("/api/me", headers={"Authorization": "Bearer "})
    assert r.status_code == 401


def test_protected_endpoints_reject_non_bearer_scheme(raw_client):
    """Basic-auth header is not a Clerk JWT — must 401, not silently accept."""
    r = raw_client.get("/api/me", headers={"Authorization": "Basic Zm9vOmJhcg=="})
    assert r.status_code == 401


# --- Bookmarklet token: scope and rejection ----------------------------------


def test_bookmarklet_token_authenticates_save(raw_client, fake_article):
    """The extension's POST /api/save with ?token= must work without a
    Clerk Bearer header."""
    token = raw_client.seeded_user["bookmarklet_token"]
    r = raw_client.post(
        f"/api/save?token={token}",
        json={"url": "https://example.com/from-extension"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["duplicate"] is False


def test_bookmarklet_token_authenticates_articles_list(raw_client, fake_article):
    """Extension popup lists recents via GET /api/articles?token=..."""
    token = raw_client.seeded_user["bookmarklet_token"]
    raw_client.post(
        f"/api/save?token={token}",
        json={"url": "https://example.com/listed"},
    )
    r = raw_client.get(f"/api/articles?token={token}")
    assert r.status_code == 200
    urls = [a["url"] for a in r.json()]
    assert "https://example.com/listed" in urls


def test_bookmarklet_token_authenticates_get_save(raw_client, fake_article):
    """GET /save (the bookmarklet endpoint) must accept ?token=..."""
    token = raw_client.seeded_user["bookmarklet_token"]
    r = raw_client.get(
        f"/save?token={token}&url=https://example.com/bookmarklet"
    )
    assert r.status_code == 200
    assert "Saved" in r.text or "Already saved" in r.text


def test_bookmarklet_unknown_token_rejected(raw_client):
    """A made-up token must not authenticate."""
    r = raw_client.post(
        "/api/save?token=totally-not-a-real-token",
        json={"url": "https://example.com/x"},
    )
    assert r.status_code == 401


# --- A09 — Security event audit log ---------------------------------------


def _audit_events(event: str | None = None) -> list[dict]:
    from app import db

    with db.connect() as conn:
        if event:
            rows = conn.execute(
                "SELECT event, ip, detail, path FROM auth_events WHERE event = ? ORDER BY id",
                (event,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT event, ip, detail, path FROM auth_events ORDER BY id"
            ).fetchall()
    return [dict(r) for r in rows]


def test_audit_logs_missing_bearer(raw_client):
    raw_client.get("/api/me")
    events = _audit_events("missing_bearer")
    assert len(events) == 1
    assert events[0]["path"] == "/api/me"


def test_audit_logs_invalid_bookmarklet(raw_client):
    raw_client.post(
        "/api/save?token=not-a-real-token",
        json={"url": "https://example.com/audit"},
    )
    events = _audit_events("invalid_bookmarklet")
    assert len(events) == 1
    # Detail must only contain a short prefix of the bad token — never the
    # whole thing — so the audit log itself can't be used to learn valid
    # tokens.
    assert "not-a-" in events[0]["detail"] and "real-token" not in events[0]["detail"]


def test_audit_records_rate_limit(client, fake_article, monkeypatch):
    from app import ratelimit
    from app.main import app, _save_limit

    monkeypatch.setattr(ratelimit, "_ENABLED", True)
    tight = ratelimit.make_limiter(per_minute=300, burst=1)
    app.dependency_overrides[_save_limit] = tight

    try:
        # First save succeeds, second should be rate-limited.
        client.post("/api/save", json={"url": "https://example.com/a-1"})
        client.post("/api/save", json={"url": "https://example.com/a-2"})
    finally:
        app.dependency_overrides.pop(_save_limit, None)

    events = _audit_events("rate_limit")
    assert len(events) >= 1
    assert events[-1]["path"] == "/api/save"


# --- A04 — Rate limiting --------------------------------------------------


def test_rate_limit_kicks_in_on_save(client, fake_article, monkeypatch):
    """Hammering /api/save past the per-minute limit must start returning
    429 instead of letting requests through."""
    from app import ratelimit

    monkeypatch.setattr(ratelimit, "_ENABLED", True)
    # Use a fresh bucket scoped just to this test so we don't interact
    # with other tests' state.
    tight = ratelimit.make_limiter(per_minute=300, burst=3)

    from app.main import app, _save_limit

    app.dependency_overrides[_save_limit] = tight

    try:
        ok = 0
        rate_limited = 0
        for i in range(8):
            r = client.post("/api/save", json={"url": f"https://example.com/rl-{i}"})
            if r.status_code == 200:
                ok += 1
            elif r.status_code == 429:
                rate_limited += 1
            else:
                raise AssertionError(f"unexpected {r.status_code}: {r.text[:120]}")
        # Burst=3 → first three succeed, the rest 429.
        assert ok == 3, f"expected 3 successful saves before limit, got {ok}"
        assert rate_limited == 5, f"expected 5 429s after limit, got {rate_limited}"
    finally:
        app.dependency_overrides.pop(_save_limit, None)


def test_bookmarklet_token_rejected_on_clerk_only_endpoints(raw_client):
    """Endpoints that require a real Clerk session must NOT accept a
    bookmarklet token via ?token=. The bookmarklet token is intentionally
    scoped to save/list, not chat/research/highlights.
    """
    token = raw_client.seeded_user["bookmarklet_token"]
    clerk_only = [
        ("GET", "/api/me"),
        ("GET", "/api/usage"),
        ("GET", "/api/highlights"),
        ("GET", "/api/tags"),
        ("POST", "/api/articles/1/chat"),
        ("POST", "/api/articles/1/research"),
    ]
    for method, path in clerk_only:
        r = raw_client.request(
            method,
            f"{path}{'&' if '?' in path else '?'}token={token}",
            json={"question": "hi", "history": []} if method == "POST" else None,
        )
        assert r.status_code == 401, (
            f"{method} {path} must reject bookmarklet token, got {r.status_code}"
        )
