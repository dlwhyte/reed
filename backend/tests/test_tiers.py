"""Tier-system tests:
- free → no chat / research, save cap of 200/mo
- plus → chat (100/mo cap), research (30/mo cap), unlimited saves
- admin → everything unlimited

Plus a few admin-endpoint tests.
"""
from __future__ import annotations

import pytest


@pytest.fixture
def tier_clients(db_setup):
    """Three TestClients impersonating users on each tier."""
    from fastapi.testclient import TestClient
    from app import auth
    from app.main import app

    free_user = db_setup("free_clerk", "free@example.com", "free-bm", tier="free")
    plus_user = db_setup("plus_clerk", "plus@example.com", "plus-bm", tier="plus")
    admin_user = db_setup("admin_clerk", "admin@example.com", "admin-bm", tier="admin")

    class UserClient(TestClient):
        def __init__(self, user: dict):
            super().__init__(app)
            self.user = user

        def request(self, *args, **kwargs):
            app.dependency_overrides[auth.current_user] = lambda u=self.user: u
            app.dependency_overrides[auth.current_user_or_bookmarklet] = lambda u=self.user: u
            return super().request(*args, **kwargs)

    free_c = UserClient(free_user)
    plus_c = UserClient(plus_user)
    admin_c = UserClient(admin_user)
    try:
        yield free_c, plus_c, admin_c
    finally:
        app.dependency_overrides.clear()


# --- Feature gating ---------------------------------------------------------


def test_free_user_blocked_from_chat(tier_clients, fake_article):
    free, _, _ = tier_clients
    aid = free.post("/api/save", json={"url": "https://example.com/free-chat"}).json()["id"]

    r = free.post(f"/api/articles/{aid}/chat", json={"question": "hi", "history": []})
    assert r.status_code == 403
    assert "Plus tier" in r.json()["detail"]


def test_free_user_blocked_from_research(tier_clients, fake_article):
    free, _, _ = tier_clients
    aid = free.post("/api/save", json={"url": "https://example.com/free-research"}).json()["id"]

    r = free.post(f"/api/articles/{aid}/research", json={"question": "hi", "history": []})
    assert r.status_code == 403


def test_plus_user_can_chat(tier_clients, fake_article, monkeypatch):
    """Plus user passes the gate. We don't actually exercise the LLM (it's
    disabled in tests), so we just confirm the request is accepted —
    the chat handler still produces a streaming response."""
    _, plus, _ = tier_clients
    aid = plus.post("/api/save", json={"url": "https://example.com/plus-chat"}).json()["id"]

    r = plus.post(f"/api/articles/{aid}/chat", json={"question": "hi", "history": []})
    # 200 = stream opened (disabled-LLM message goes through it).
    assert r.status_code == 200


def test_admin_user_can_research(tier_clients, fake_article):
    _, _, admin = tier_clients
    aid = admin.post("/api/save", json={"url": "https://example.com/admin-research"}).json()["id"]

    r = admin.post(f"/api/articles/{aid}/research", json={"question": "hi", "history": []})
    assert r.status_code == 200


# --- Save cap on free ------------------------------------------------------


def test_free_save_cap_enforced(tier_clients, fake_article, monkeypatch):
    """Drop the free-tier save cap to a tiny number and verify the 201st
    save returns 429."""
    from app import tiers

    monkeypatch.setitem(tiers.TIERS["free"]["caps"], "save", 3)
    free, _, _ = tier_clients

    for i in range(3):
        r = free.post("/api/save", json={"url": f"https://example.com/cap-{i}"})
        assert r.status_code == 200

    r = free.post("/api/save", json={"url": "https://example.com/cap-over"})
    assert r.status_code == 429
    assert "save cap" in r.json()["detail"].lower()


def test_plus_save_unlimited(tier_clients, fake_article, monkeypatch):
    """Even with the free cap dropped, plus has no save cap so it
    keeps working."""
    from app import tiers

    monkeypatch.setitem(tiers.TIERS["free"]["caps"], "save", 1)
    _, plus, _ = tier_clients

    for i in range(5):
        r = plus.post("/api/save", json={"url": f"https://example.com/plus-{i}"})
        assert r.status_code == 200, r.text


# --- /api/me reflects tier + quotas ----------------------------------------


def test_me_includes_tier_and_quotas(tier_clients, fake_article):
    free, _, _ = tier_clients
    free.post("/api/save", json={"url": "https://example.com/me-1"})
    free.post("/api/save", json={"url": "https://example.com/me-2"})

    me = free.get("/api/me").json()
    assert me["tier"] == "free"
    assert me["features"]["chat"] is False
    assert me["features"]["research"] is False
    assert me["quotas"]["save"]["cap"] == 200
    assert me["quotas"]["save"]["used"] == 2
    assert me["quotas"]["save"]["remaining"] == 198
    assert me["quotas"]["chat"]["cap"] == 0
    assert me["quotas"]["research"]["cap"] == 0


def test_me_admin_shows_unlimited(tier_clients):
    _, _, admin = tier_clients
    me = admin.get("/api/me").json()
    assert me["tier"] == "admin"
    assert me["quotas"]["save"]["cap"] is None
    assert me["quotas"]["chat"]["cap"] is None
    assert me["quotas"]["research"]["cap"] is None


# --- Admin endpoints --------------------------------------------------------


def test_admin_endpoints_require_admin_tier(tier_clients):
    free, plus, admin = tier_clients
    # Free + plus → 403
    assert free.get("/api/admin/users").status_code == 403
    assert plus.get("/api/admin/users").status_code == 403
    # Admin → 200
    r = admin.get("/api/admin/users")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 3  # free, plus, admin
    emails = {u["email"] for u in rows}
    assert emails == {"free@example.com", "plus@example.com", "admin@example.com"}


def test_admin_can_promote_user(tier_clients, fake_article):
    free, _, admin = tier_clients
    free_id = free.user["id"]

    # Confirm free can't chat first.
    aid = free.post("/api/save", json={"url": "https://example.com/promote"}).json()["id"]
    assert (
        free.post(f"/api/articles/{aid}/chat", json={"question": "x", "history": []}).status_code
        == 403
    )

    # Promote.
    r = admin.patch(f"/api/admin/users/{free_id}", json={"tier": "plus"})
    assert r.status_code == 200
    # Update the in-memory user dict so subsequent free.request() calls
    # send the new tier (the override returns this dict directly).
    free.user["tier"] = "plus"

    # Now chat works.
    r = free.post(f"/api/articles/{aid}/chat", json={"question": "x", "history": []})
    assert r.status_code == 200


def test_admin_cannot_demote_self(tier_clients):
    _, _, admin = tier_clients
    r = admin.patch(f"/api/admin/users/{admin.user['id']}", json={"tier": "free"})
    assert r.status_code == 400
    assert "yourself" in r.json()["detail"].lower()


def test_admin_rejects_unknown_tier(tier_clients):
    free, _, admin = tier_clients
    r = admin.patch(f"/api/admin/users/{free.user['id']}", json={"tier": "platinum"})
    assert r.status_code == 400


# --- Bootstrap admin via env var -------------------------------------------


def test_bootstrap_admin_promotes_existing_user(db_setup, monkeypatch):
    """When BOOTSTRAP_ADMIN_EMAIL matches a user's email on next login,
    they auto-promote to admin. Existing-user path."""
    from app import auth, config

    user = db_setup("alice_clerk", "alice@example.com", "alice-bm", tier="free")
    monkeypatch.setattr(config, "BOOTSTRAP_ADMIN_EMAIL", "alice@example.com")
    monkeypatch.setattr(auth, "BOOTSTRAP_ADMIN_EMAIL", "alice@example.com")

    promoted = auth._get_or_create_user("alice_clerk", "alice@example.com")
    assert promoted["tier"] == "admin"


def test_bootstrap_admin_promotes_new_user(db_setup, monkeypatch):
    """First-time signup with the bootstrap email → admin from the start."""
    from app import auth, config

    monkeypatch.setattr(config, "BOOTSTRAP_ADMIN_EMAIL", "founder@example.com")
    monkeypatch.setattr(auth, "BOOTSTRAP_ADMIN_EMAIL", "founder@example.com")

    new_user = auth._get_or_create_user("founder_clerk_id", "founder@example.com")
    assert new_user["tier"] == "admin"
