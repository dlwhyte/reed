"""Cross-user isolation + auth-required coverage, mirroring the pattern in
backend/tests/test_security.py (reed's main app).
"""
from __future__ import annotations


def test_alice_cannot_see_bobs_notes(two_clients):
    alice, bob = two_clients
    bob.post("/api/notes", json={"title": "Bob's secret", "body": "shh"})

    r = alice.get("/api/notes")
    assert r.status_code == 200
    assert r.json() == []
    assert len(bob.get("/api/notes").json()) == 1


def test_alice_cannot_read_update_or_delete_bobs_note(two_clients):
    alice, bob = two_clients
    note_id = bob.post("/api/notes", json={"body": "bob only"}).json()["id"]

    assert alice.get(f"/api/notes/{note_id}").status_code == 404
    assert alice.patch(f"/api/notes/{note_id}", json={"is_pinned": True}).status_code == 404
    assert alice.delete(f"/api/notes/{note_id}").status_code == 404

    assert bob.get(f"/api/notes/{note_id}").status_code == 200


def test_alice_cannot_see_or_use_bobs_labels(two_clients):
    alice, bob = two_clients
    bob_label = bob.post("/api/labels", json={"name": "Bob Only"}).json()

    assert alice.get("/api/labels").json() == []

    r = alice.post("/api/notes", json={"body": "mine", "label_ids": [bob_label["id"]]})
    assert r.status_code == 200
    assert r.json()["label_ids"] == []

    assert alice.delete(f"/api/labels/{bob_label['id']}").status_code == 404
    assert alice.patch(f"/api/labels/{bob_label['id']}", json={"name": "Hijacked"}).status_code == 404
    assert bob.get("/api/labels").json()[0]["name"] == "Bob Only"


def test_alice_cannot_bulk_relabel_bobs_notes(two_clients):
    alice, bob = two_clients
    bob_note = bob.post("/api/notes", json={"body": "bob's"}).json()
    alice_label = alice.post("/api/labels", json={"name": "Alice's label"}).json()

    r = alice.post(
        "/api/notes/bulk-relabel",
        json={"note_ids": [bob_note["id"]], "add_label_ids": [alice_label["id"]]},
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 0

    assert bob.get(f"/api/notes/{bob_note['id']}").json()["label_ids"] == []


def test_protected_endpoints_require_auth(raw_client):
    public = [("GET", "/api/health")]
    protected = [
        ("GET", "/api/me"),
        ("GET", "/api/notes"),
        ("POST", "/api/notes"),
        ("GET", "/api/notes/1"),
        ("PATCH", "/api/notes/1"),
        ("DELETE", "/api/notes/1"),
        ("POST", "/api/notes/bulk-relabel"),
        ("GET", "/api/labels"),
        ("POST", "/api/labels"),
        ("PATCH", "/api/labels/1"),
        ("DELETE", "/api/labels/1"),
        ("GET", "/api/saved-views"),
        ("POST", "/api/saved-views"),
        ("DELETE", "/api/saved-views/1"),
    ]

    for method, path in public:
        r = raw_client.request(method, path)
        assert r.status_code == 200, f"{method} {path} should be public, got {r.status_code}"

    for method, path in protected:
        r = raw_client.request(method, path, json={} if method in ("POST", "PATCH") else None)
        assert r.status_code == 401, f"{method} {path} should require auth, got {r.status_code}: {r.text[:120]}"
