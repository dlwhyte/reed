"""Happy-path CRUD + FTS/nesting/bulk-relabel coverage for the notes API."""
from __future__ import annotations


# --- Notes / labels / saved views --------------------------------------------


def test_notes_crud(client):
    created = client.post(
        "/api/notes", json={"title": "Idea", "body": "write it down"}
    ).json()
    assert created["title"] == "Idea"
    assert created["label_ids"] == []
    nid = created["id"]

    assert client.get(f"/api/notes/{nid}").json()["body"] == "write it down"

    client.patch(f"/api/notes/{nid}", json={"is_pinned": True, "body": "updated"})
    fetched = client.get(f"/api/notes/{nid}").json()
    assert fetched["is_pinned"] == 1
    assert fetched["body"] == "updated"

    assert client.delete(f"/api/notes/{nid}").status_code == 200
    assert client.get(f"/api/notes/{nid}").status_code == 404


def test_notes_list_filters_by_state(client):
    active_id = client.post("/api/notes", json={"body": "active"}).json()["id"]
    archived = client.post("/api/notes", json={"body": "archived"}).json()
    client.patch(f"/api/notes/{archived['id']}", json={"is_archived": True})

    assert [n["id"] for n in client.get("/api/notes?state=active").json()] == [active_id]
    assert [n["id"] for n in client.get("/api/notes?state=archived").json()] == [archived["id"]]
    assert len(client.get("/api/notes?state=all").json()) == 2


def test_notes_fts_search(client):
    client.post("/api/notes", json={"title": "Quarterly plan", "body": "budget notes"})
    client.post("/api/notes", json={"title": "Grocery list", "body": "milk, eggs"})

    results = client.get("/api/notes?q=budget").json()
    assert len(results) == 1
    assert results[0]["title"] == "Quarterly plan"


def test_labels_nesting_and_delete_promotes_children(client):
    parent = client.post("/api/labels", json={"name": "Work"}).json()
    child = client.post(
        "/api/labels", json={"name": "Projects", "parent_id": parent["id"]}
    ).json()
    assert child["parent_id"] == parent["id"]

    # Duplicate name at the same level is rejected.
    assert client.post("/api/labels", json={"name": "Work"}).status_code == 409

    client.delete(f"/api/labels/{parent['id']}")
    remaining = client.get("/api/labels").json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == child["id"]
    assert remaining[0]["parent_id"] is None


def test_labels_cannot_be_own_parent(client):
    label = client.post("/api/labels", json={"name": "Loop"}).json()
    r = client.patch(f"/api/labels/{label['id']}", json={"parent_id": label["id"]})
    assert r.status_code == 400


def test_note_labels_filter_includes_nested_children(client):
    parent = client.post("/api/labels", json={"name": "Research"}).json()
    child = client.post(
        "/api/labels", json={"name": "AI", "parent_id": parent["id"]}
    ).json()
    note = client.post(
        "/api/notes", json={"body": "deepfakes", "label_ids": [child["id"]]}
    ).json()
    assert note["label_ids"] == [child["id"]]

    # Filtering by the parent label surfaces notes tagged only with the child.
    by_parent = client.get(f"/api/notes?label_id={parent['id']}").json()
    assert [n["id"] for n in by_parent] == [note["id"]]


def test_notes_bulk_relabel(client):
    label_a = client.post("/api/labels", json={"name": "A"}).json()
    label_b = client.post("/api/labels", json={"name": "B"}).json()
    n1 = client.post("/api/notes", json={"body": "one", "label_ids": [label_a["id"]]}).json()
    n2 = client.post("/api/notes", json={"body": "two"}).json()

    r = client.post(
        "/api/notes/bulk-relabel",
        json={
            "note_ids": [n1["id"], n2["id"]],
            "add_label_ids": [label_b["id"]],
            "remove_label_ids": [label_a["id"]],
        },
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 2

    assert client.get(f"/api/notes/{n1['id']}").json()["label_ids"] == [label_b["id"]]
    assert client.get(f"/api/notes/{n2['id']}").json()["label_ids"] == [label_b["id"]]


def test_saved_views_crud(client):
    label = client.post("/api/labels", json={"name": "Reading"}).json()
    created = client.post(
        "/api/saved-views",
        json={"name": "To read", "label_ids": [label["id"]], "archived_filter": "active"},
    ).json()
    assert created["name"] == "To read"
    assert created["label_ids"] == [label["id"]]

    views = client.get("/api/saved-views").json()
    assert len(views) == 1

    assert client.delete(f"/api/saved-views/{created['id']}").status_code == 200
    assert client.get("/api/saved-views").json() == []


def test_health_and_me(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    r = client.get("/api/me")
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"
