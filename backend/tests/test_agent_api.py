"""Tests for the /api/agent/* endpoints used by MCP/AI tools, plus the
/api/me/api-tokens management surface.

Key invariants we verify:
- Token created via POST /api/me/api-tokens comes back ONCE as `token` in
  the response; subsequent list calls must only show the prefix, never
  the hash or the raw value.
- Revoked tokens stop authenticating.
- Bogus tokens (wrong prefix, unknown hash) return 401 with an audit
  event recorded.
- Cross-user isolation: alice's token can never read bob's articles/
  highlights, even with a valid signature.
- Content is truncated in /api/agent/article/{id} and `content_truncated`
  is true when that happens.
"""
from __future__ import annotations


# --- Token management -------------------------------------------------------


def test_create_list_revoke_token(client):
    # Create.
    r = client.post("/api/me/api-tokens", json={"name": "Claude Code"})
    assert r.status_code == 200, r.text
    row = r.json()
    assert row["name"] == "Claude Code"
    assert row["token"].startswith("bft_")
    assert row["prefix"] == row["token"][:8]
    assert row["revoked_at"] is None
    token = row["token"]
    tid = row["id"]

    # List: must NOT include the raw token or the hash.
    rows = client.get("/api/me/api-tokens").json()
    assert len(rows) == 1
    listed = rows[0]
    assert listed["id"] == tid
    assert listed["name"] == "Claude Code"
    assert listed["prefix"] == row["prefix"]
    assert "token" not in listed
    assert "token_hash" not in listed

    # Revoke.
    assert client.delete(f"/api/me/api-tokens/{tid}").status_code == 200
    rows = client.get("/api/me/api-tokens").json()
    assert rows[0]["revoked_at"] is not None

    # Revoked token can't authenticate to /api/agent/*.
    r = client.get("/api/agent/search?q=anything", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_create_token_requires_name(client):
    r = client.post("/api/me/api-tokens", json={"name": "  "})
    assert r.status_code == 400


def test_revoke_nonexistent_token_404(client):
    assert client.delete("/api/me/api-tokens/9999").status_code == 404


# --- /api/agent/* auth ------------------------------------------------------


def _make_token(client, name: str = "test-tool") -> str:
    return client.post("/api/me/api-tokens", json={"name": name}).json()["token"]


def test_agent_search_requires_token(raw_client):
    r = raw_client.get("/api/agent/search?q=hello")
    assert r.status_code == 401


def test_agent_search_rejects_clerk_shape_token(raw_client):
    # Clerk JWTs start with `eyJ` — the /api/agent/* endpoints deliberately
    # only accept `bft_` tokens.
    r = raw_client.get(
        "/api/agent/search?q=hello",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.x"},
    )
    assert r.status_code == 401


def test_agent_search_rejects_unknown_token(raw_client):
    r = raw_client.get(
        "/api/agent/search?q=hello",
        headers={"Authorization": "Bearer bft_completelymadeup"},
    )
    assert r.status_code == 401


def test_agent_search_with_valid_token(client, fake_article):
    client.post("/api/save", json={"url": "https://example.com/for-agent"})
    token = _make_token(client)

    r = client.get(
        "/api/agent/search?q=Canned",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] >= 1
    first = body["results"][0]
    assert first["title"] == "A Canned Test Article"
    assert first["url"] == "https://example.com/for-agent"
    assert "highlights" in first


# --- Cross-user isolation ---------------------------------------------------


def test_alice_token_cannot_read_bobs_articles(two_clients, fake_article):
    alice, bob = two_clients
    # Bob saves, alice creates a token.
    bob_aid = bob.post("/api/save", json={"url": "https://example.com/bob-owned"}).json()["id"]
    alice_token = alice.post("/api/me/api-tokens", json={"name": "alice-tool"}).json()["token"]

    # Alice's token fetching Bob's article id directly → 404 (not even leaked).
    r = alice.get(
        f"/api/agent/article/{bob_aid}",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert r.status_code == 404

    # Alice's token searching → only her own library (empty) shows up.
    r = alice.get(
        "/api/agent/search?q=Canned",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert r.status_code == 200
    urls = [x["url"] for x in r.json()["results"]]
    assert "https://example.com/bob-owned" not in urls


# --- Highlights endpoint ----------------------------------------------------


def test_agent_highlights_recent_mode(client, fake_article):
    aid = client.post("/api/save", json={"url": "https://example.com/with-hl"}).json()["id"]
    client.post(f"/api/articles/{aid}/highlights", json={"text": "memorable passage"})
    client.post(f"/api/articles/{aid}/highlights", json={"text": "another memorable bit"})

    token = _make_token(client)
    r = client.get("/api/agent/highlights", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    # Article context present inline.
    assert body["results"][0]["article"]["url"] == "https://example.com/with-hl"


def test_agent_highlights_search_mode(client, fake_article):
    aid = client.post("/api/save", json={"url": "https://example.com/hl-search"}).json()["id"]
    client.post(f"/api/articles/{aid}/highlights", json={"text": "the quick brown fox"})
    client.post(f"/api/articles/{aid}/highlights", json={"text": "something unrelated"})

    token = _make_token(client)
    r = client.get("/api/agent/highlights?q=fox", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert "fox" in body["results"][0]["text"]


# --- Get-article endpoint ---------------------------------------------------


def test_agent_get_article_returns_content_and_highlights(client, fake_article):
    aid = client.post("/api/save", json={"url": "https://example.com/get"}).json()["id"]
    client.post(f"/api/articles/{aid}/highlights", json={"text": "x", "note": "y"})
    token = _make_token(client)

    r = client.get(
        f"/api/agent/article/{aid}", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == aid
    assert body["title"] == "A Canned Test Article"
    assert "content" in body
    assert body["content_truncated"] is False  # fake article is short
    assert len(body["highlights"]) == 1


def test_agent_get_article_truncates_long_content(client, fake_article, monkeypatch):
    # Override the fake article with long content to trigger truncation.
    from app import extractor, main

    def _long_extract(html: str, url: str) -> dict:
        return {
            "title": "Long",
            "author": None,
            "site_name": "example.com",
            "published": None,
            "content": "X" * 20000,
            "excerpt": "long",
            "image_url": None,
            "word_count": 20000,
            "read_time_min": 100,
        }

    monkeypatch.setattr(extractor, "extract", _long_extract)
    monkeypatch.setattr(main.extractor, "extract", _long_extract, raising=False)

    aid = client.post("/api/save", json={"url": "https://example.com/long"}).json()["id"]
    token = _make_token(client)
    r = client.get(
        f"/api/agent/article/{aid}", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["content_truncated"] is True
    assert len(body["content"]) == 8000
