import json
import asyncio
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, db, extractor, cohere_client, agent


app = FastAPI(title="Reader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db.init_db()


class SaveReq(BaseModel):
    url: str


class UpdateReq(BaseModel):
    is_archived: bool | None = None
    is_favorite: bool | None = None
    progress: float | None = None
    tags: list[str] | None = None


class ChatReq(BaseModel):
    question: str
    history: list[dict] = []


@app.get("/api/health")
def health():
    return {"ok": True, "llm": config.LLM_READY}


@app.post("/api/save")
async def save(req: SaveReq):
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")

    with db.connect() as conn:
        existing = conn.execute(
            "SELECT id FROM articles WHERE url = ?", (url,)
        ).fetchone()
        if existing:
            return {"id": existing["id"], "duplicate": True}

    try:
        html = await extractor.fetch_html(url)
        article = extractor.extract(html, url)
    except Exception as e:
        raise HTTPException(400, f"Could not fetch article: {e}")

    if not article["content"] or len(article["content"]) < 100:
        raise HTTPException(400, "Could not extract readable content from URL")

    summary_short = ""
    summary_long = ""
    tags: list[str] = []
    embedding_blob = b""

    if config.LLM_READY:
        try:
            llm_data = await cohere_client.summarize_and_tag(
                article["title"], article["content"]
            )
            summary_short = llm_data["summary_short"]
            summary_long = llm_data["summary_long"]
            tags = llm_data["tags"]
        except Exception as e:
            print(f"[llm] summary failed: {e}")

        try:
            vecs = await cohere_client.embed(
                [article["title"] + "\n\n" + article["content"][:4000]]
            )
            if vecs and vecs[0]:
                embedding_blob = cohere_client.embedding_to_blob(vecs[0])
        except Exception as e:
            print(f"[llm] embed failed: {e}")

    with db.connect() as conn:
        cur = conn.execute(
            """INSERT INTO articles
            (url, title, author, site_name, published, content, excerpt,
             image_url, word_count, read_time_min, summary_short, summary_long,
             tags, embedding)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                url, article["title"], article["author"], article["site_name"],
                article["published"], article["content"], article["excerpt"],
                article["image_url"], article["word_count"], article["read_time_min"],
                summary_short, summary_long, json.dumps(tags), embedding_blob,
            ),
        )
        return {"id": cur.lastrowid, "duplicate": False, "title": article["title"]}


@app.get("/share", response_class=HTMLResponse)
async def share_target(
    url: str | None = None,
    text: str | None = None,
    title: str | None = None,
):
    """Web Share Target endpoint (PWA share_target spec).
    Extracts a URL from url/text/title fields and saves it, then redirects to library."""
    import re as _re
    candidate = url or ""
    if not candidate and text:
        m = _re.search(r"https?://\S+", text)
        if m:
            candidate = m.group(0).rstrip(').,;:!?"\'')
    if not candidate and title:
        m = _re.search(r"https?://\S+", title)
        if m:
            candidate = m.group(0).rstrip(').,;:!?"\'')

    if not candidate.startswith(("http://", "https://")):
        return HTMLResponse(
            "<!doctype html><meta charset=utf-8><title>reed</title>"
            "<body style=\"font:15px -apple-system;margin:40px;\">"
            "<h2>No URL found in share</h2>"
            "<p>Try sharing a link directly.</p>"
            "<p><a href=\"/\">Back to reed</a></p></body>",
            status_code=400,
        )
    return await save_via_get(candidate)


@app.get("/save", response_class=HTMLResponse)
async def save_via_get(url: str):
    """GET save endpoint for the bookmarklet (works from HTTPS pages via popup)."""
    try:
        result = await save(SaveReq(url=url))
        title = result.get("title") or url
        status = "Already saved" if result.get("duplicate") else "Saved"
        color = "#888" if result.get("duplicate") else "#0a7a2a"
    except HTTPException as e:
        title = e.detail
        status = "Error"
        color = "#c0392b"
    except Exception as e:
        title = str(e)
        status = "Error"
        color = "#c0392b"

    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{status} — Reader</title>
<style>
  body {{ font: 15px -apple-system, BlinkMacSystemFont, sans-serif;
          margin: 0; padding: 24px; color: #222; background: #fafafa; }}
  .card {{ background: white; border-radius: 10px; padding: 20px;
           box-shadow: 0 1px 3px rgba(0,0,0,0.08); max-width: 360px; }}
  .status {{ font-weight: 600; color: {color}; margin-bottom: 8px; }}
  .title {{ font-size: 14px; color: #444; word-break: break-word; }}
  .actions {{ margin-top: 16px; display: flex; gap: 8px; }}
  a, button {{ font: inherit; padding: 6px 12px; border-radius: 6px;
               border: 1px solid #ddd; background: white; color: #222;
               text-decoration: none; cursor: pointer; }}
  a:hover, button:hover {{ background: #f0f0f0; }}
</style>
<script>setTimeout(() => window.close(), 1500);</script>
</head><body>
  <div class="card">
    <div class="status">{status}</div>
    <div class="title">{title}</div>
    <div class="actions">
      <a href="http://localhost:5173/" target="_blank">Open Reader</a>
      <button onclick="window.close()">Close</button>
    </div>
  </div>
</body></html>"""
    return HTMLResponse(content=html)


@app.get("/api/articles")
def list_articles(
    state: str = Query("unread", pattern="^(unread|archived|favorites|all)$"),
    tag: str | None = None,
    sort: str = Query("newest", pattern="^(newest|oldest|longest|shortest)$"),
    limit: int = 200,
):
    where = []
    params: list = []
    if state == "unread":
        where.append("is_archived = 0")
    elif state == "archived":
        where.append("is_archived = 1")
    elif state == "favorites":
        where.append("is_favorite = 1")

    if tag:
        where.append("tags LIKE ?")
        params.append(f'%"{tag}"%')

    where_sql = "WHERE " + " AND ".join(where) if where else ""
    order = {
        "newest": "created_at DESC",
        "oldest": "created_at ASC",
        "longest": "word_count DESC",
        "shortest": "word_count ASC",
    }[sort]

    with db.connect() as conn:
        rows = conn.execute(
            f"""SELECT id, url, title, author, site_name, published, excerpt,
                image_url, word_count, read_time_min, summary_short, summary_long,
                tags, is_archived, is_favorite, progress, created_at, read_at
                FROM articles {where_sql} ORDER BY {order} LIMIT ?""",
            (*params, limit),
        ).fetchall()
    return [db.row_to_dict(r) for r in rows]


@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    return db.row_to_full_dict(row)


@app.patch("/api/articles/{article_id}")
def update_article(article_id: int, req: UpdateReq):
    fields = []
    params: list = []
    if req.is_archived is not None:
        fields.append("is_archived = ?")
        params.append(1 if req.is_archived else 0)
    if req.is_favorite is not None:
        fields.append("is_favorite = ?")
        params.append(1 if req.is_favorite else 0)
    if req.progress is not None:
        fields.append("progress = ?")
        params.append(max(0.0, min(1.0, req.progress)))
    if req.tags is not None:
        fields.append("tags = ?")
        params.append(json.dumps([t.lower().strip() for t in req.tags]))

    if not fields:
        return {"ok": True}

    params.append(article_id)
    with db.connect() as conn:
        conn.execute(
            f"UPDATE articles SET {', '.join(fields)} WHERE id = ?", tuple(params)
        )
    return {"ok": True}


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int):
    with db.connect() as conn:
        conn.execute("DELETE FROM articles WHERE id = ?", (article_id,))
    return {"ok": True}


@app.get("/api/search")
def search(q: str, limit: int = 50):
    if not q.strip():
        return []
    with db.connect() as conn:
        try:
            rows = conn.execute(
                """SELECT a.id, a.url, a.title, a.author, a.site_name, a.excerpt,
                    a.image_url, a.word_count, a.read_time_min, a.summary_short,
                    a.summary_long, a.tags, a.is_archived, a.is_favorite,
                    a.progress, a.created_at, a.read_at
                   FROM articles a
                   JOIN articles_fts f ON f.rowid = a.id
                   WHERE articles_fts MATCH ?
                   ORDER BY rank LIMIT ?""",
                (q, limit),
            ).fetchall()
        except Exception:
            rows = conn.execute(
                """SELECT id, url, title, author, site_name, excerpt, image_url,
                    word_count, read_time_min, summary_short, summary_long, tags,
                    is_archived, is_favorite, progress, created_at, read_at
                   FROM articles WHERE title LIKE ? OR excerpt LIKE ?
                   ORDER BY created_at DESC LIMIT ?""",
                (f"%{q}%", f"%{q}%", limit),
            ).fetchall()
    return [db.row_to_dict(r) for r in rows]


@app.get("/api/semantic-search")
async def semantic_search(q: str, limit: int = 20):
    if not q.strip():
        return []
    if not config.LLM_READY:
        raise HTTPException(400, "Enable LLM features to use semantic search")

    query_vecs = await cohere_client.embed([q], input_type="search_query")
    if not query_vecs or not query_vecs[0]:
        return []
    qvec = query_vecs[0]

    with db.connect() as conn:
        rows = conn.execute(
            """SELECT id, url, title, author, site_name, excerpt, image_url,
                word_count, read_time_min, summary_short, summary_long, tags,
                is_archived, is_favorite, progress, created_at, read_at, embedding
               FROM articles WHERE embedding IS NOT NULL AND length(embedding) > 0"""
        ).fetchall()

    scored = []
    for r in rows:
        vec = cohere_client.blob_to_embedding(r["embedding"])
        if vec:
            score = cohere_client.cosine(qvec, vec)
            scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {**db.row_to_dict(r), "similarity": round(s, 3)}
        for s, r in scored[:limit]
    ]


SIMILAR_THRESHOLD = 0.45


@app.get("/api/articles/{article_id}/similar")
async def similar(article_id: int, limit: int = 5):
    if not config.LLM_READY:
        return []
    with db.connect() as conn:
        target = conn.execute(
            "SELECT embedding FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
        if not target or not target["embedding"]:
            return []
        tvec = cohere_client.blob_to_embedding(target["embedding"])

        rows = conn.execute(
            """SELECT id, url, title, site_name, excerpt, image_url,
                word_count, read_time_min, tags, embedding
               FROM articles WHERE id != ? AND length(embedding) > 0""",
            (article_id,),
        ).fetchall()

    scored = []
    for r in rows:
        vec = cohere_client.blob_to_embedding(r["embedding"])
        if vec:
            score = cohere_client.cosine(tvec, vec)
            if score >= SIMILAR_THRESHOLD:
                scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    out = []
    for s, r in scored[:limit]:
        d = db.row_to_dict(r)
        d["similarity"] = round(s, 3)
        out.append(d)
    return out


@app.get("/api/tags")
def list_tags():
    with db.connect() as conn:
        rows = conn.execute("SELECT tags FROM articles").fetchall()
    counts: dict[str, int] = {}
    for r in rows:
        try:
            for t in json.loads(r["tags"] or "[]"):
                counts[t] = counts.get(t, 0) + 1
        except Exception:
            pass
    return [
        {"tag": t, "count": c}
        for t, c in sorted(counts.items(), key=lambda x: -x[1])
    ]


@app.post("/api/articles/{article_id}/chat")
async def chat(article_id: int, req: ChatReq):
    with db.connect() as conn:
        row = conn.execute(
            "SELECT title, content FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Not found")

    async def event_stream():
        try:
            async for chunk in cohere_client.chat_with_article_stream(
                row["title"], row["content"], req.history, req.question
            ):
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
                await asyncio.sleep(0)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/articles/{article_id}/research")
async def research(article_id: int, req: ChatReq):
    async def event_stream():
        try:
            async for event in agent.run_research(article_id, req.question):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/config")
def get_config():
    return {
        "llm_ready": config.LLM_READY,
        "enable_llm": config.ENABLE_LLM,
        "web_search_ready": config.WEB_SEARCH_READY,
        "chat_model": config.COHERE_CHAT_MODEL,
        "embed_model": config.COHERE_EMBED_MODEL,
        "port": config.PORT,
    }


# --- Serve the built frontend from the same origin (if it exists) ------------
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        # Never shadow API / bookmarklet routes (FastAPI registers in order,
        # but belt-and-suspenders: reject anything api-looking here too).
        if full_path.startswith(("api/", "save", "share")):
            raise HTTPException(404)
        return FileResponse(FRONTEND_DIST / "index.html")
