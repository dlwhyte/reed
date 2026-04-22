"""Smoke + security tests for the BrowseFellow backend.

These deliberately cover the hot paths rather than aiming for full
coverage: saving, listing, searching, usage rollups, highlights,
CORS, SSRF guards, XSS escaping, SPA path traversal, and the
cohere_client token-extraction helper.
"""
from __future__ import annotations

from types import SimpleNamespace


# --- /api/health + /api/config ------------------------------------------------


def test_health_and_config(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # LLM is forced off in conftest.
    assert r.json()["llm"] is False

    cfg = client.get("/api/config").json()
    assert cfg["llm_ready"] is False
    assert "chat_model" in cfg


# --- /api/save + article CRUD -------------------------------------------------


def test_save_fetch_list_and_patch(client, fake_article):
    r = client.post("/api/save", json={"url": "https://example.com/post-1"})
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["duplicate"] is False
    aid = saved["id"]

    # Fetching it back returns the stored fields.
    r = client.get(f"/api/articles/{aid}")
    assert r.status_code == 200
    art = r.json()
    assert art["title"] == "A Canned Test Article"
    assert art["url"] == "https://example.com/post-1"

    # Listing returns it in the default unread bucket.
    rows = client.get("/api/articles").json()
    assert any(a["id"] == aid for a in rows)

    # Archive it and verify the filter flips.
    client.patch(f"/api/articles/{aid}", json={"is_archived": True})
    assert all(a["id"] != aid for a in client.get("/api/articles").json())
    archived = client.get("/api/articles?state=archived").json()
    assert any(a["id"] == aid for a in archived)

    # Favorite + tag updates round-trip.
    client.patch(
        f"/api/articles/{aid}",
        json={"is_favorite": True, "tags": ["python", "TESTING"]},
    )
    tags = client.get(f"/api/articles/{aid}").json()["tags"]
    assert tags == ["python", "testing"]

    # Delete cleans up.
    client.delete(f"/api/articles/{aid}")
    assert client.get(f"/api/articles/{aid}").status_code == 404


def test_save_dedupes_same_url(client, fake_article):
    u = "https://example.com/post-dedup"
    a = client.post("/api/save", json={"url": u}).json()
    b = client.post("/api/save", json={"url": u}).json()
    assert a["id"] == b["id"]
    assert b["duplicate"] is True


def test_save_rejects_bad_scheme(client):
    r = client.post("/api/save", json={"url": "ftp://files.example.com/x"})
    assert r.status_code == 400
    assert "http://" in r.json()["detail"]


def test_save_rejects_oversized_url(client):
    r = client.post("/api/save", json={"url": "https://a/" + "x" * 4000})
    assert r.status_code == 400


def test_save_rejects_private_ip_when_not_allowed(monkeypatch, client):
    # Force SSRF protection back on for this test (conftest turns it off
    # so the fake_article fixture can work against a made-up host).
    from app import main

    monkeypatch.setattr(main, "_ALLOW_PRIVATE_URLS", False)

    for bad in (
        "http://127.0.0.1/secret",
        "http://10.0.0.1/admin",
        "http://169.254.169.254/meta",
        "http://192.168.1.1/",
    ):
        r = client.post("/api/save", json={"url": bad})
        assert r.status_code == 400, f"{bad} should have been rejected"


# --- /api/search (FTS5) -------------------------------------------------------


def test_search_finds_saved_article(client, fake_article):
    client.post("/api/save", json={"url": "https://example.com/fts"})
    hits = client.get("/api/search?q=canned").json()
    assert hits, "FTS5 should have matched the title token 'canned'"


# --- /api/tags aggregation ----------------------------------------------------


def test_tags_aggregate(client, fake_article):
    client.post("/api/save", json={"url": "https://example.com/tag-1"})
    aid = client.get("/api/articles").json()[0]["id"]
    client.patch(
        f"/api/articles/{aid}",
        json={"tags": ["python", "testing", "python"]},
    )
    tags = {t["tag"]: t["count"] for t in client.get("/api/tags").json()}
    # Duplicates in the input still land as a single tag on the article,
    # and the aggregation counts each article once.
    assert tags.get("python") == 1
    assert tags.get("testing") == 1


# --- Highlights CRUD ----------------------------------------------------------


def test_highlights_crud(client, fake_article):
    client.post("/api/save", json={"url": "https://example.com/hl"})
    aid = client.get("/api/articles").json()[0]["id"]

    # Empty URL-ish input rejected.
    assert client.post(
        f"/api/articles/{aid}/highlights", json={"text": "   "}
    ).status_code == 400

    created = client.post(
        f"/api/articles/{aid}/highlights",
        json={"text": "memorable passage"},
    ).json()
    assert created["text"] == "memorable passage"
    hid = created["id"]

    assert len(client.get(f"/api/articles/{aid}/highlights").json()) == 1
    assert len(client.get("/api/highlights").json()) == 1

    client.delete(f"/api/highlights/{hid}")
    assert client.get(f"/api/articles/{aid}/highlights").json() == []


# --- /api/usage rollups -------------------------------------------------------


def test_usage_empty(client):
    u = client.get("/api/usage").json()
    for bucket in ("today", "month", "all_time"):
        assert u[bucket]["input_tokens"] == 0
        assert u[bucket]["output_tokens"] == 0
        assert u[bucket]["usd"] == 0
        assert u[bucket]["by_endpoint"] == {}
    assert "command-a-03-2025" in u["pricing"]


def test_usage_rollup_counts_and_dollars(client):
    from app import cohere_client

    uid = client.test_user["id"]
    # Record a handful of calls across endpoints / models, all attributed
    # to the test user so the /api/usage rollup (which filters by user_id)
    # picks them up.
    cohere_client.record_usage("save_summarize", "command-a-03-2025", 4000, 200, user_id=uid)
    cohere_client.record_usage("chat", "command-a-03-2025", 8000, 500, user_id=uid)
    cohere_client.record_usage("save_embed", "embed-english-v3.0", 2000, 0, user_id=uid)

    u = client.get("/api/usage").json()
    month = u["month"]
    assert month["calls"] == 3
    assert month["input_tokens"] == 14000
    assert month["output_tokens"] == 700

    # Dollar math: command-a input ($2.50 / 1M) + output ($10 / 1M)
    #   => (12000 * 2.50 + 700 * 10) / 1_000_000 = 0.037
    #   plus embed input 2000 * 0.10 / 1_000_000 = 0.0002
    # Total ≈ 0.0372
    assert round(month["usd"], 4) == 0.0372

    # Breakdown keys are the endpoint labels we passed in.
    assert set(month["by_endpoint"].keys()) == {
        "save_summarize",
        "chat",
        "save_embed",
    }


# --- cohere_client token extraction (unit) ------------------------------------


def test_extract_tokens_usage_tokens_path():
    from app import cohere_client

    resp = SimpleNamespace(
        usage=SimpleNamespace(
            tokens=SimpleNamespace(input_tokens=42, output_tokens=7)
        )
    )
    assert cohere_client._extract_tokens(resp) == (42, 7)


def test_extract_tokens_meta_billed_units_path():
    from app import cohere_client

    resp = SimpleNamespace(
        meta=SimpleNamespace(
            billed_units=SimpleNamespace(input_tokens=99, output_tokens=None)
        )
    )
    assert cohere_client._extract_tokens(resp) == (99, 0)


def test_extract_tokens_missing_returns_zero():
    from app import cohere_client

    resp = SimpleNamespace()
    assert cohere_client._extract_tokens(resp) == (0, 0)


# --- CORS allowlist -----------------------------------------------------------


def test_cors_allows_known_origin(client):
    r = client.options(
        "/api/articles",
        headers={
            "Origin": "https://browsefellow.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code in (200, 204)
    assert r.headers.get("access-control-allow-origin") == "https://browsefellow.com"


def test_cors_allows_multi_segment_tailscale_hostname(client):
    """Real Tailscale hostnames are `<host>.<tailnet>.ts.net` — two
    subdomain segments before ts.net — not just one."""
    origin = "https://ds-macbook-pro-2.tail3f024c.ts.net"
    r = client.options(
        "/api/articles",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.headers.get("access-control-allow-origin") == origin


def test_cors_rejects_unknown_origin(client):
    r = client.options(
        "/api/articles",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Starlette's CORSMiddleware simply omits the allow-origin header for
    # disallowed origins; the browser then blocks the request on the
    # client side.
    assert r.headers.get("access-control-allow-origin") != "https://evil.example.com"


# --- XSS escape in /save HTML response ---------------------------------------


def test_save_html_escapes_title(monkeypatch, client):
    """The /save endpoint renders the article title into an HTML page.
    A malicious page title must not inject a <script> tag."""
    from app import extractor, main

    async def _fetch(url: str) -> str:
        return ""

    def _extract(html: str, url: str) -> dict:
        return {
            "title": '<script>alert("xss")</script>',
            "author": None,
            "site_name": None,
            "published": None,
            "content": "x" * 200,
            "excerpt": "x",
            "image_url": None,
            "word_count": 200,
            "read_time_min": 1,
        }

    monkeypatch.setattr(extractor, "fetch_html", _fetch)
    monkeypatch.setattr(extractor, "extract", _extract)
    monkeypatch.setattr(main.extractor, "fetch_html", _fetch, raising=False)
    monkeypatch.setattr(main.extractor, "extract", _extract, raising=False)

    r = client.get("/save?url=https://example.com/xss-test")
    assert r.status_code == 200
    body = r.text
    assert "<script>alert" not in body
    assert "&lt;script&gt;alert" in body


# --- SPA fallback path traversal ---------------------------------------------


def test_spa_does_not_serve_outside_dist(client):
    # Even if a dist/ exists, the SPA handler must refuse '..'-style
    # traversal attempts and not serve files above the dist directory.
    r = client.get("/../backend/app/config.py")
    # Starlette normalizes the URL, so this usually becomes the SPA
    # fallback (index.html) or a 404 if dist/ doesn't exist. Either is
    # fine — what must NOT happen is config.py being returned.
    assert "COHERE_API_KEY" not in r.text
