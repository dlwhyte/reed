from __future__ import annotations

import json

from pydantic import BaseModel
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .auth import current_user


app = FastAPI(title="Notes")

# Same allowed-origin shape as BrowseFellow's backend: localhost/127.0.0.1
# at any port (dev), the production subdomain, and Tailscale hostnames.
_ALLOWED_ORIGIN_RE = (
    r"^("
    r"https?://localhost(:\d+)?"
    r"|https?://127\.0\.0\.1(:\d+)?"
    r"|https?://notes\.browsefellow\.com"
    r"|https?://([a-z0-9-]+\.)+ts\.net"
    r")$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_ALLOWED_ORIGIN_RE,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.on_event("startup")
def _startup():
    db.init_db()


@app.get("/api/health")
def health():
    return {"ok": True, "auth_ready": config.AUTH_READY}


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return user


class NoteCreateReq(BaseModel):
    title: str | None = None
    body: str = ""
    color: str = "default"
    label_ids: list[int] | None = None


class NoteUpdateReq(BaseModel):
    title: str | None = None
    body: str | None = None
    color: str | None = None
    is_pinned: bool | None = None
    is_archived: bool | None = None
    label_ids: list[int] | None = None


class BulkRelabelReq(BaseModel):
    note_ids: list[int]
    add_label_ids: list[int] | None = None
    remove_label_ids: list[int] | None = None


class LabelCreateReq(BaseModel):
    name: str
    parent_id: int | None = None
    color: str = "default"


class LabelUpdateReq(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    color: str | None = None


class SavedViewCreateReq(BaseModel):
    name: str
    label_ids: list[int] = []
    search_text: str | None = None
    archived_filter: str = "active"


def _label_ids_for_notes(user_id: int, note_ids: list[int]) -> dict[int, list[int]]:
    """Fetch label ids for a set of notes, grouped by note_id."""
    if not note_ids:
        return {}
    placeholders = ",".join("?" * len(note_ids))
    with db.connect() as conn:
        rows = conn.execute(
            f"""SELECT nl.note_id, nl.label_id
                FROM note_labels nl
                JOIN notes n ON n.id = nl.note_id
                WHERE n.user_id = ? AND nl.note_id IN ({placeholders})""",
            (user_id, *note_ids),
        ).fetchall()
    grouped: dict[int, list[int]] = {}
    for r in rows:
        grouped.setdefault(r["note_id"], []).append(r["label_id"])
    return grouped


def _descendant_label_ids(user_id: int, label_id: int) -> list[int]:
    """A label plus all of its nested descendants, so filtering by a parent
    label also surfaces notes tagged only with one of its children."""
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT id, parent_id FROM labels WHERE user_id = ?", (user_id,)
        ).fetchall()
    children: dict[int, list[int]] = {}
    for r in rows:
        if r["parent_id"] is not None:
            children.setdefault(r["parent_id"], []).append(r["id"])
    result = [label_id]
    stack = [label_id]
    while stack:
        cur = stack.pop()
        for c in children.get(cur, []):
            result.append(c)
            stack.append(c)
    return result


def _set_note_labels(conn, user_id: int, note_id: int, label_ids: list[int]) -> None:
    """Replace a note's labels wholesale, silently dropping any id that
    isn't a label the current user owns."""
    conn.execute("DELETE FROM note_labels WHERE note_id = ?", (note_id,))
    if not label_ids:
        return
    placeholders = ",".join("?" * len(label_ids))
    valid_rows = conn.execute(
        f"SELECT id FROM labels WHERE user_id = ? AND id IN ({placeholders})",
        (user_id, *label_ids),
    ).fetchall()
    valid_ids = {r["id"] for r in valid_rows}
    conn.executemany(
        "INSERT OR IGNORE INTO note_labels (note_id, label_id) VALUES (?, ?)",
        [(note_id, lid) for lid in label_ids if lid in valid_ids],
    )


@app.get("/api/notes")
def list_notes(
    state: str = Query("active", pattern="^(active|archived|all)$"),
    label_id: int | None = None,
    q: str | None = None,
    limit: int = 200,
    user: dict = Depends(current_user),
):
    where = ["n.user_id = ?"]
    params: list = [user["id"]]
    if state == "active":
        where.append("n.is_archived = 0")
    elif state == "archived":
        where.append("n.is_archived = 1")

    if label_id is not None:
        label_ids = _descendant_label_ids(user["id"], label_id)
        placeholders = ",".join("?" * len(label_ids))
        where.append(
            f"n.id IN (SELECT note_id FROM note_labels WHERE label_id IN ({placeholders}))"
        )
        params.extend(label_ids)

    join_sql = ""
    if q and q.strip():
        join_sql = "JOIN notes_fts f ON f.rowid = n.id"
        where.append("notes_fts MATCH ?")
        params.append(q)

    where_sql = "WHERE " + " AND ".join(where)
    with db.connect() as conn:
        try:
            rows = conn.execute(
                f"""SELECT n.id, n.user_id, n.title, n.body, n.color, n.is_pinned,
                    n.is_archived, n.created_at, n.updated_at
                    FROM notes n {join_sql} {where_sql}
                    ORDER BY n.is_pinned DESC, n.updated_at DESC LIMIT ?""",
                (*params, limit),
            ).fetchall()
        except db.sqlite3.OperationalError:
            rows = []

    note_ids = [r["id"] for r in rows]
    labels_by_note = _label_ids_for_notes(user["id"], note_ids)
    return [db.row_to_note_dict(r, labels_by_note.get(r["id"], [])) for r in rows]


@app.post("/api/notes")
def create_note(req: NoteCreateReq, user: dict = Depends(current_user)):
    with db.connect() as conn:
        cur = conn.execute(
            "INSERT INTO notes (user_id, title, body, color) VALUES (?, ?, ?, ?)",
            (user["id"], req.title, req.body, req.color),
        )
        note_id = cur.lastrowid
        if req.label_ids:
            _set_note_labels(conn, user["id"], note_id, req.label_ids)
        row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    label_ids = _label_ids_for_notes(user["id"], [note_id]).get(note_id, [])
    return db.row_to_note_dict(row, label_ids)


@app.get("/api/notes/{note_id}")
def get_note(note_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    label_ids = _label_ids_for_notes(user["id"], [note_id]).get(note_id, [])
    return db.row_to_note_dict(row, label_ids)


@app.patch("/api/notes/{note_id}")
def update_note(note_id: int, req: NoteUpdateReq, user: dict = Depends(current_user)):
    fields = []
    params: list = []
    if req.title is not None:
        fields.append("title = ?")
        params.append(req.title)
    if req.body is not None:
        fields.append("body = ?")
        params.append(req.body)
    if req.color is not None:
        fields.append("color = ?")
        params.append(req.color)
    if req.is_pinned is not None:
        fields.append("is_pinned = ?")
        params.append(1 if req.is_pinned else 0)
    if req.is_archived is not None:
        fields.append("is_archived = ?")
        params.append(1 if req.is_archived else 0)
    if fields:
        fields.append("updated_at = CURRENT_TIMESTAMP")

    with db.connect() as conn:
        exists = conn.execute(
            "SELECT 1 FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user["id"]),
        ).fetchone()
        if not exists:
            raise HTTPException(404, "Not found")
        if fields:
            params.extend([note_id, user["id"]])
            conn.execute(
                f"UPDATE notes SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
                tuple(params),
            )
        if req.label_ids is not None:
            _set_note_labels(conn, user["id"], note_id, req.label_ids)
    return {"ok": True}


@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        cur = conn.execute(
            "DELETE FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user["id"]),
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.post("/api/notes/bulk-relabel")
def bulk_relabel_notes(req: BulkRelabelReq, user: dict = Depends(current_user)):
    if not req.note_ids:
        return {"ok": True, "updated": 0}
    with db.connect() as conn:
        note_placeholders = ",".join("?" * len(req.note_ids))
        owned_rows = conn.execute(
            f"SELECT id FROM notes WHERE user_id = ? AND id IN ({note_placeholders})",
            (user["id"], *req.note_ids),
        ).fetchall()
        owned_ids = [r["id"] for r in owned_rows]
        if not owned_ids:
            return {"ok": True, "updated": 0}
        owned_placeholders = ",".join("?" * len(owned_ids))

        if req.remove_label_ids:
            rl_placeholders = ",".join("?" * len(req.remove_label_ids))
            conn.execute(
                f"""DELETE FROM note_labels
                    WHERE note_id IN ({owned_placeholders})
                    AND label_id IN ({rl_placeholders})""",
                (*owned_ids, *req.remove_label_ids),
            )

        if req.add_label_ids:
            al_placeholders = ",".join("?" * len(req.add_label_ids))
            valid_rows = conn.execute(
                f"SELECT id FROM labels WHERE user_id = ? AND id IN ({al_placeholders})",
                (user["id"], *req.add_label_ids),
            ).fetchall()
            valid_label_ids = [r["id"] for r in valid_rows]
            conn.executemany(
                "INSERT OR IGNORE INTO note_labels (note_id, label_id) VALUES (?, ?)",
                [(nid, lid) for nid in owned_ids for lid in valid_label_ids],
            )

        conn.execute(
            f"UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id IN ({owned_placeholders})",
            tuple(owned_ids),
        )
    return {"ok": True, "updated": len(owned_ids)}


@app.get("/api/labels")
def list_labels(user: dict = Depends(current_user)):
    with db.connect() as conn:
        rows = conn.execute(
            """SELECT l.id, l.name, l.parent_id, l.color,
                (SELECT COUNT(*) FROM note_labels nl WHERE nl.label_id = l.id) AS note_count
               FROM labels l WHERE l.user_id = ? ORDER BY l.name ASC""",
            (user["id"],),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/labels")
def create_label(req: LabelCreateReq, user: dict = Depends(current_user)):
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "name is required")
    with db.connect() as conn:
        if req.parent_id is not None:
            parent = conn.execute(
                "SELECT 1 FROM labels WHERE id = ? AND user_id = ?",
                (req.parent_id, user["id"]),
            ).fetchone()
            if not parent:
                raise HTTPException(404, "parent label not found")
        try:
            cur = conn.execute(
                "INSERT INTO labels (user_id, name, parent_id, color) VALUES (?, ?, ?, ?)",
                (user["id"], name, req.parent_id, req.color),
            )
        except db.sqlite3.IntegrityError:
            raise HTTPException(409, "a label with this name already exists here")
        row = conn.execute(
            "SELECT id, name, parent_id, color FROM labels WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return {**dict(row), "note_count": 0}


@app.patch("/api/labels/{label_id}")
def update_label(
    label_id: int, req: LabelUpdateReq, user: dict = Depends(current_user)
):
    fields = []
    params: list = []
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(400, "name is required")
        fields.append("name = ?")
        params.append(name)
    if req.color is not None:
        fields.append("color = ?")
        params.append(req.color)
    moving = "parent_id" in req.model_fields_set
    if moving:
        if req.parent_id == label_id:
            raise HTTPException(400, "a label cannot be its own parent")
        fields.append("parent_id = ?")
        params.append(req.parent_id)

    if not fields:
        return {"ok": True}

    with db.connect() as conn:
        if moving and req.parent_id is not None:
            parent = conn.execute(
                "SELECT 1 FROM labels WHERE id = ? AND user_id = ?",
                (req.parent_id, user["id"]),
            ).fetchone()
            if not parent:
                raise HTTPException(404, "parent label not found")
        params.extend([label_id, user["id"]])
        try:
            cur = conn.execute(
                f"UPDATE labels SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
                tuple(params),
            )
        except db.sqlite3.IntegrityError:
            raise HTTPException(409, "a label with this name already exists here")
    if cur.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.delete("/api/labels/{label_id}")
def delete_label(label_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        cur = conn.execute(
            "DELETE FROM labels WHERE id = ? AND user_id = ?",
            (label_id, user["id"]),
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.get("/api/saved-views")
def list_saved_views(user: dict = Depends(current_user)):
    with db.connect() as conn:
        rows = conn.execute(
            """SELECT id, name, label_ids, search_text, archived_filter, sort_order, created_at
               FROM saved_views WHERE user_id = ? ORDER BY sort_order ASC, id ASC""",
            (user["id"],),
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["label_ids"] = json.loads(d["label_ids"])
        except Exception:
            d["label_ids"] = []
        result.append(d)
    return result


@app.post("/api/saved-views")
def create_saved_view(req: SavedViewCreateReq, user: dict = Depends(current_user)):
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "name is required")
    with db.connect() as conn:
        cur = conn.execute(
            """INSERT INTO saved_views (user_id, name, label_ids, search_text, archived_filter)
               VALUES (?, ?, ?, ?, ?)""",
            (
                user["id"],
                name,
                json.dumps(req.label_ids),
                req.search_text,
                req.archived_filter,
            ),
        )
        row = conn.execute(
            """SELECT id, name, label_ids, search_text, archived_filter, sort_order, created_at
               FROM saved_views WHERE id = ?""",
            (cur.lastrowid,),
        ).fetchone()
    d = dict(row)
    d["label_ids"] = json.loads(d["label_ids"])
    return d


@app.delete("/api/saved-views/{view_id}")
def delete_saved_view(view_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        cur = conn.execute(
            "DELETE FROM saved_views WHERE id = ? AND user_id = ?",
            (view_id, user["id"]),
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
