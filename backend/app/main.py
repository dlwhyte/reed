from __future__ import annotations

import html as _html
import ipaddress
import json
import asyncio
import os
import socket
from pathlib import Path
from urllib.parse import urlparse
from pydantic import BaseModel
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from . import api_tokens, config, db, extractor, cohere_client, agent, tiers
from .auth import (
    current_user,
    current_user_or_bookmarklet,
    current_user_via_api_token,
    regenerate_bookmarklet_token,
)
from .ratelimit import make_limiter


# Per-endpoint limiters. Burst defaults to the per-minute number, so a
# user can do their full minute of work in one go and then has to wait.
_save_limit = make_limiter(60)
_share_limit = make_limiter(60)
_chat_limit = make_limiter(20)
_research_limit = make_limiter(10)
_semantic_limit = make_limiter(30)
_regen_limit = make_limiter(6)
# Agent endpoints are hit by AI tools, which can burst requests — allow
# higher rates than human-facing endpoints. Keyed by hashed API token
# (see ratelimit.py) so each tool has its own bucket.
_agent_search_limit = make_limiter(120)
_agent_article_limit = make_limiter(240)
_agent_highlights_limit = make_limiter(120)


app = FastAPI(title="Reader")

# Allow the BrowseFellow frontend (wherever it's served from), the Vite dev
# server, Tailscale's magic-DNS hostnames, any custom apex, and the Chrome
# extension. Rejects arbitrary websites from CSRF-ing the save endpoint.
_ALLOWED_ORIGIN_RE = (
    r"^("
    r"https?://localhost(:\d+)?"
    r"|https?://127\.0\.0\.1(:\d+)?"
    r"|https?://browsefellow\.com"
    r"|https?://www\.browsefellow\.com"
    r"|https?://([a-z0-9-]+\.)+ts\.net"
    r"|chrome-extension://[a-z]+"
    r")$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_ALLOWED_ORIGIN_RE,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# Cap URL input at a sane length to avoid pathological trafilatura runs on
# attacker-supplied huge query strings.
MAX_URL_LENGTH = 2048
# Default: reject save URLs that resolve to the loopback / RFC1918 space,
# since the backend can otherwise be used as an SSRF relay to whatever else
# lives on the host / tailnet. Override during local development by setting
# READER_ALLOW_PRIVATE_URLS=true.
_ALLOW_PRIVATE_URLS = os.getenv("READER_ALLOW_PRIVATE_URLS", "false").lower() == "true"


def _is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
    )


def _validate_save_url(url: str) -> None:
    if len(url) > MAX_URL_LENGTH:
        raise HTTPException(400, "URL is too long")
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")
    if _ALLOW_PRIVATE_URLS:
        return
    host = urlparse(url).hostname
    if not host:
        raise HTTPException(400, "URL is missing a host")
    if _is_private_ip(host):
        raise HTTPException(400, "Refusing to fetch a private/loopback address")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return
    for info in infos:
        ip = info[4][0]
        if _is_private_ip(ip):
            raise HTTPException(400, "Refusing to fetch a private/loopback address")


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


class HighlightReq(BaseModel):
    text: str
    note: str | None = None


@app.get("/api/health")
def health():
    return {"ok": True, "llm": config.LLM_READY}


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    tier_def = tiers.tier_of(user)
    return {
        "id": user["id"],
        "clerk_user_id": user["clerk_user_id"],
        "email": user["email"],
        "bookmarklet_token": user["bookmarklet_token"],
        "tier": user.get("tier") or tiers.DEFAULT_TIER,
        "tier_label": tier_def["label"],
        "features": tier_def["features"],
        "quotas": {
            kind: {
                "cap": tiers.cap_for(user, kind),
                "used": tiers.usage_this_month(user["id"], kind),
                "remaining": tiers.remaining(user, kind),
            }
            for kind in ("save", "chat", "research")
        },
    }


@app.post("/api/me/regenerate-bookmarklet-token")
def regenerate_token(
    user: dict = Depends(current_user),
    _: None = Depends(_regen_limit),
):
    return {"bookmarklet_token": regenerate_bookmarklet_token(user["id"])}


# --- Agent API (for AI tools via MCP / direct REST) -----------------------
# These endpoints are deliberately narrow: only API-token auth (bft_...),
# scoped to the token's user, returning compact JSON so the payload fits
# cleanly in an LLM context window.


def _article_to_agent_summary(row: db.sqlite3.Row, similarity: float | None = None) -> dict:
    d = db.row_to_dict(row)
    out = {
        "id": d["id"],
        "title": d.get("title") or "",
        "url": d.get("url") or "",
        "site_name": d.get("site_name") or None,
        "excerpt": (d.get("excerpt") or "")[:400],
        "summary": d.get("summary_short") or d.get("summary_long") or None,
        "tags": d.get("tags") or [],
        "created_at": d.get("created_at"),
    }
    if similarity is not None:
        out["similarity"] = round(similarity, 3)
    return out


def _highlights_for_articles(user_id: int, article_ids: list[int]) -> dict[int, list[dict]]:
    """Fetch highlights for a set of articles, grouped by article_id."""
    if not article_ids:
        return {}
    placeholders = ",".join("?" * len(article_ids))
    with db.connect() as conn:
        rows = conn.execute(
            f"""SELECT article_id, text, note
                FROM highlights
                WHERE user_id = ? AND article_id IN ({placeholders})
                ORDER BY id ASC""",
            (user_id, *article_ids),
        ).fetchall()
    grouped: dict[int, list[dict]] = {}
    for r in rows:
        grouped.setdefault(r["article_id"], []).append(
            {"text": r["text"], "note": r["note"]}
        )
    return grouped


@app.get("/api/agent/search")
async def agent_search(
    q: str,
    limit: int = 10,
    user: dict = Depends(current_user_via_api_token),
    _rl: None = Depends(_agent_search_limit),
):
    """Semantic-if-available-else-keyword search over the user's library.
    Returns each result with its highlights inline, so an AI tool only
    needs one call to get the gist of a topic from the user's library."""
    q = (q or "").strip()
    if not q:
        return {"query": q, "count": 0, "results": []}
    limit = max(1, min(limit, 25))

    # Try semantic first if LLM is available; fall back to FTS5 keyword
    # search so the agent API works even without a Cohere key.
    scored: list[tuple[float | None, db.sqlite3.Row]] = []
    if config.LLM_READY:
        try:
            qvecs = await cohere_client.embed(
                [q],
                input_type="search_query",
                endpoint="agent_search",
                user_id=user["id"],
            )
            if qvecs and qvecs[0]:
                qvec = qvecs[0]
                with db.connect() as conn:
                    rows = conn.execute(
                        """SELECT id, url, title, author, site_name, excerpt,
                            image_url, word_count, read_time_min, summary_short,
                            summary_long, tags, is_archived, is_favorite,
                            progress, created_at, read_at, embedding
                           FROM articles
                           WHERE user_id = ? AND embedding IS NOT NULL AND length(embedding) > 0""",
                        (user["id"],),
                    ).fetchall()
                for r in rows:
                    v = cohere_client.blob_to_embedding(r["embedding"])
                    if v:
                        scored.append((cohere_client.cosine(qvec, v), r))
                scored.sort(key=lambda x: x[0] or 0, reverse=True)
                scored = scored[:limit]
        except Exception as e:
            print(f"[agent_search] semantic fallback due to: {e}")
            scored = []

    if not scored:
        # Keyword fallback via FTS5.
        with db.connect() as conn:
            try:
                rows = conn.execute(
                    """SELECT a.id, a.url, a.title, a.author, a.site_name, a.excerpt,
                        a.image_url, a.word_count, a.read_time_min, a.summary_short,
                        a.summary_long, a.tags, a.is_archived, a.is_favorite,
                        a.progress, a.created_at, a.read_at
                       FROM articles a JOIN articles_fts f ON f.rowid = a.id
                       WHERE articles_fts MATCH ? AND a.user_id = ?
                       ORDER BY rank LIMIT ?""",
                    (q, user["id"], limit),
                ).fetchall()
            except Exception:
                rows = conn.execute(
                    """SELECT id, url, title, author, site_name, excerpt, image_url,
                        word_count, read_time_min, summary_short, summary_long, tags,
                        is_archived, is_favorite, progress, created_at, read_at
                       FROM articles
                       WHERE user_id = ? AND (title LIKE ? OR excerpt LIKE ?)
                       ORDER BY created_at DESC LIMIT ?""",
                    (user["id"], f"%{q}%", f"%{q}%", limit),
                ).fetchall()
        scored = [(None, r) for r in rows]

    article_ids = [r["id"] for _, r in scored]
    highlights_by_article = _highlights_for_articles(user["id"], article_ids)

    results = []
    for sim, r in scored:
        summary = _article_to_agent_summary(r, sim)
        summary["highlights"] = highlights_by_article.get(r["id"], [])
        results.append(summary)

    return {"query": q, "count": len(results), "results": results}


@app.get("/api/agent/article/{article_id}")
def agent_get_article(
    article_id: int,
    user: dict = Depends(current_user_via_api_token),
    _rl: None = Depends(_agent_article_limit),
):
    """Full readable text + all highlights for one article. Content is
    truncated to 8000 chars so a single article never blows out an LLM
    context window — the caller can re-fetch with ?full=true if needed."""
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    d = db.row_to_full_dict(row)
    content = d.get("content") or ""
    MAX_LEN = 8000
    truncated = len(content) > MAX_LEN
    out = {
        "id": d["id"],
        "title": d.get("title") or "",
        "url": d.get("url") or "",
        "site_name": d.get("site_name") or None,
        "author": d.get("author") or None,
        "published": d.get("published") or None,
        "excerpt": d.get("excerpt") or None,
        "summary_short": d.get("summary_short") or None,
        "summary_long": d.get("summary_long") or None,
        "tags": d.get("tags") or [],
        "word_count": d.get("word_count") or 0,
        "read_time_min": d.get("read_time_min") or 0,
        "created_at": d.get("created_at"),
        "content": content[:MAX_LEN],
        "content_truncated": truncated,
        "highlights": _highlights_for_articles(user["id"], [d["id"]]).get(d["id"], []),
    }
    return out


@app.get("/api/agent/highlights")
def agent_search_highlights(
    q: str | None = None,
    limit: int = 20,
    user: dict = Depends(current_user_via_api_token),
    _rl: None = Depends(_agent_highlights_limit),
):
    """Return highlights (with article context) matching `q` — or the
    most-recent N highlights if `q` is omitted. Highlights are often the
    most useful agent context because they're the user's *own words*
    selected passages, not generic article content."""
    limit = max(1, min(limit, 50))
    with db.connect() as conn:
        if q and q.strip():
            rows = conn.execute(
                """SELECT h.id, h.text, h.note, h.created_at,
                          a.id AS article_id, a.title AS article_title,
                          a.url AS article_url, a.site_name AS article_site
                   FROM highlights h JOIN articles a ON a.id = h.article_id
                   WHERE h.user_id = ?
                     AND (h.text LIKE ? OR h.note LIKE ?)
                   ORDER BY h.id DESC LIMIT ?""",
                (user["id"], f"%{q.strip()}%", f"%{q.strip()}%", limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT h.id, h.text, h.note, h.created_at,
                          a.id AS article_id, a.title AS article_title,
                          a.url AS article_url, a.site_name AS article_site
                   FROM highlights h JOIN articles a ON a.id = h.article_id
                   WHERE h.user_id = ?
                   ORDER BY h.id DESC LIMIT ?""",
                (user["id"], limit),
            ).fetchall()
    return {
        "query": q or "",
        "count": len(rows),
        "results": [
            {
                "id": r["id"],
                "text": r["text"],
                "note": r["note"],
                "created_at": r["created_at"],
                "article": {
                    "id": r["article_id"],
                    "title": r["article_title"],
                    "url": r["article_url"],
                    "site_name": r["article_site"],
                },
            }
            for r in rows
        ],
    }


# --- Token management endpoints (user manages their own AI-tool tokens) ---


class ApiTokenCreateReq(BaseModel):
    name: str


@app.get("/api/me/api-tokens")
def list_api_tokens(user: dict = Depends(current_user)):
    return api_tokens.list_for_user(user["id"])


@app.post("/api/me/api-tokens")
def create_api_token(
    req: ApiTokenCreateReq,
    user: dict = Depends(current_user),
    _: None = Depends(_regen_limit),
):
    name = (req.name or "").strip()[:60]
    if not name:
        raise HTTPException(400, "Token name is required")
    raw, row = api_tokens.create(user["id"], name)
    # Include the raw token ONCE — frontend is expected to show it
    # immediately and never persist it beyond the copy-to-clipboard flow.
    return {**row, "token": raw}


@app.delete("/api/me/api-tokens/{token_id}")
def revoke_api_token(token_id: int, user: dict = Depends(current_user)):
    if not api_tokens.revoke(user["id"], token_id):
        raise HTTPException(404, "Token not found or already revoked")
    return {"ok": True}


# --- Admin endpoints (tier='admin' only) ----------------------------------


class TierUpdateReq(BaseModel):
    tier: str


@app.get("/api/admin/users")
def admin_list_users(_: dict = Depends(tiers.require_admin())):
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT id, clerk_user_id, email, tier, created_at FROM users ORDER BY id"
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["saves_this_month"] = tiers.usage_this_month(r["id"], "save")
        d["chats_this_month"] = tiers.usage_this_month(r["id"], "chat")
        d["research_this_month"] = tiers.usage_this_month(r["id"], "research")
        out.append(d)
    return out


@app.patch("/api/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    req: TierUpdateReq,
    admin: dict = Depends(tiers.require_admin()),
):
    if req.tier not in tiers.TIERS:
        raise HTTPException(
            400, f"Unknown tier '{req.tier}'. Valid: {', '.join(tiers.TIERS.keys())}"
        )
    if user_id == admin["id"] and req.tier != "admin":
        raise HTTPException(
            400, "Refusing to demote yourself — promote another admin first."
        )
    with db.connect() as conn:
        cur = conn.execute(
            "UPDATE users SET tier = ? WHERE id = ?", (req.tier, user_id)
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True, "id": user_id, "tier": req.tier}


async def _save_article(user_id: int, url: str) -> dict:
    """Shared save path. Returns {id, duplicate, title}. Raises HTTPException
    on fetch/extract failure."""
    url = url.strip()
    _validate_save_url(url)

    with db.connect() as conn:
        existing = conn.execute(
            "SELECT id, title FROM articles WHERE user_id = ? AND url = ?",
            (user_id, url),
        ).fetchone()
        if existing:
            return {"id": existing["id"], "duplicate": True, "title": existing["title"]}

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
                article["title"], article["content"], user_id=user_id
            )
            summary_short = llm_data["summary_short"]
            summary_long = llm_data["summary_long"]
            tags = llm_data["tags"]
        except Exception as e:
            print(f"[llm] summary failed: {e}")

        try:
            vecs = await cohere_client.embed(
                [article["title"] + "\n\n" + article["content"][:4000]],
                endpoint="save_embed",
                user_id=user_id,
            )
            if vecs and vecs[0]:
                embedding_blob = cohere_client.embedding_to_blob(vecs[0])
        except Exception as e:
            print(f"[llm] embed failed: {e}")

    with db.connect() as conn:
        cur = conn.execute(
            """INSERT INTO articles
            (user_id, url, title, author, site_name, published, content, excerpt,
             image_url, word_count, read_time_min, summary_short, summary_long,
             tags, embedding)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                user_id, url, article["title"], article["author"], article["site_name"],
                article["published"], article["content"], article["excerpt"],
                article["image_url"], article["word_count"], article["read_time_min"],
                summary_short, summary_long, json.dumps(tags), embedding_blob,
            ),
        )
        return {"id": cur.lastrowid, "duplicate": False, "title": article["title"]}


@app.post("/api/save")
async def save(
    req: SaveReq,
    user: dict = Depends(current_user_or_bookmarklet),
    _rl: None = Depends(_save_limit),
):
    # Accepts either a Clerk JWT (frontend) or ?token=<bookmarklet_token>
    # (extension / bookmarklet). Save cap (200/mo on free, unlimited on
    # plus/admin) enforced inline so we don't re-trigger auth.
    tiers.check_save_cap(user)
    return await _save_article(user["id"], req.url)


@app.get("/share", response_class=HTMLResponse)
async def share_target(
    user: dict = Depends(current_user_or_bookmarklet),
    url: str | None = None,
    text: str | None = None,
    title: str | None = None,
    _rl: None = Depends(_share_limit),
):
    tiers.check_save_cap(user)
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
    if len(candidate) > MAX_URL_LENGTH:
        raise HTTPException(400, "URL is too long")
    return await _save_via_get_impl(user["id"], candidate)


@app.get("/save", response_class=HTMLResponse)
async def save_via_get(
    url: str,
    user: dict = Depends(current_user_or_bookmarklet),
    _rl: None = Depends(_share_limit),
):
    """GET save endpoint for the bookmarklet (works from HTTPS pages via popup).
    Auth via Clerk bearer OR ?token=<bookmarklet_token>."""
    tiers.check_save_cap(user)
    return await _save_via_get_impl(user["id"], url)


async def _save_via_get_impl(user_id: int, url: str) -> HTMLResponse:
    try:
        result = await _save_article(user_id, url)
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

    safe_title = _html.escape(str(title))
    safe_status = _html.escape(str(status))
    safe_color = _html.escape(str(color))
    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{safe_status} — Reader</title>
<style>
  body {{ font: 15px -apple-system, BlinkMacSystemFont, sans-serif;
          margin: 0; padding: 24px; color: #222; background: #fafafa; }}
  .card {{ background: white; border-radius: 10px; padding: 20px;
           box-shadow: 0 1px 3px rgba(0,0,0,0.08); max-width: 360px; }}
  .status {{ font-weight: 600; color: {safe_color}; margin-bottom: 8px; }}
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
    <div class="status">{safe_status}</div>
    <div class="title">{safe_title}</div>
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
    user: dict = Depends(current_user_or_bookmarklet),
):
    # Accepts Clerk JWT or ?token=<bookmarklet_token>; the extension popup
    # lists recent saves via the bookmarklet token.
    where = ["user_id = ?"]
    params: list = [user["id"]]
    if state == "unread":
        where.append("is_archived = 0")
    elif state == "archived":
        where.append("is_archived = 1")
    elif state == "favorites":
        where.append("is_favorite = 1")

    if tag:
        where.append("tags LIKE ?")
        params.append(f'%"{tag}"%')

    where_sql = "WHERE " + " AND ".join(where)
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
def get_article(article_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    return db.row_to_full_dict(row)


@app.patch("/api/articles/{article_id}")
def update_article(
    article_id: int, req: UpdateReq, user: dict = Depends(current_user)
):
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
        # Dedup while preserving order so the shelf doesn't accumulate
        # "python"/"python" from an import with casing variations.
        normalized = [t.lower().strip() for t in req.tags if t and t.strip()]
        fields.append("tags = ?")
        params.append(json.dumps(list(dict.fromkeys(normalized))))

    if not fields:
        return {"ok": True}

    params.extend([article_id, user["id"]])
    with db.connect() as conn:
        cur = conn.execute(
            f"UPDATE articles SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
            tuple(params),
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        cur = conn.execute(
            "DELETE FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user["id"]),
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.get("/api/search")
def search(q: str, limit: int = 50, user: dict = Depends(current_user)):
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
                   WHERE articles_fts MATCH ? AND a.user_id = ?
                   ORDER BY rank LIMIT ?""",
                (q, user["id"], limit),
            ).fetchall()
        except Exception:
            rows = conn.execute(
                """SELECT id, url, title, author, site_name, excerpt, image_url,
                    word_count, read_time_min, summary_short, summary_long, tags,
                    is_archived, is_favorite, progress, created_at, read_at
                   FROM articles
                   WHERE user_id = ? AND (title LIKE ? OR excerpt LIKE ?)
                   ORDER BY created_at DESC LIMIT ?""",
                (user["id"], f"%{q}%", f"%{q}%", limit),
            ).fetchall()
    return [db.row_to_dict(r) for r in rows]


@app.get("/api/semantic-search")
async def semantic_search(
    q: str,
    limit: int = 20,
    user: dict = Depends(current_user),
    _: None = Depends(_semantic_limit),
):
    if not q.strip():
        return []
    if not config.LLM_READY:
        raise HTTPException(400, "Enable LLM features to use semantic search")

    query_vecs = await cohere_client.embed(
        [q], input_type="search_query", endpoint="semantic_search", user_id=user["id"]
    )
    if not query_vecs or not query_vecs[0]:
        return []
    qvec = query_vecs[0]

    with db.connect() as conn:
        rows = conn.execute(
            """SELECT id, url, title, author, site_name, excerpt, image_url,
                word_count, read_time_min, summary_short, summary_long, tags,
                is_archived, is_favorite, progress, created_at, read_at, embedding
               FROM articles
               WHERE user_id = ? AND embedding IS NOT NULL AND length(embedding) > 0""",
            (user["id"],),
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
async def similar(article_id: int, limit: int = 5, user: dict = Depends(current_user)):
    if not config.LLM_READY:
        return []
    with db.connect() as conn:
        target = conn.execute(
            "SELECT embedding FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user["id"]),
        ).fetchone()
        if not target or not target["embedding"]:
            return []
        tvec = cohere_client.blob_to_embedding(target["embedding"])

        rows = conn.execute(
            """SELECT id, url, title, site_name, excerpt, image_url,
                word_count, read_time_min, tags, embedding
               FROM articles
               WHERE user_id = ? AND id != ? AND length(embedding) > 0""",
            (user["id"], article_id),
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
def list_tags(user: dict = Depends(current_user)):
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT tags FROM articles WHERE user_id = ?", (user["id"],)
        ).fetchall()
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
async def chat(
    article_id: int,
    req: ChatReq,
    user: dict = Depends(current_user),
    _: None = Depends(_chat_limit),
):
    tiers.check_feature_and_cap(user, "chat")
    with db.connect() as conn:
        row = conn.execute(
            "SELECT title, content FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Not found")

    async def event_stream():
        try:
            async for chunk in cohere_client.chat_with_article_stream(
                row["title"], row["content"], req.history, req.question, user_id=user["id"]
            ):
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
                await asyncio.sleep(0)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/articles/{article_id}/research")
async def research(
    article_id: int,
    req: ChatReq,
    user: dict = Depends(current_user),
    _: None = Depends(_research_limit),
):
    tiers.check_feature_and_cap(user, "research")
    # Mark a research-run counter row up front so the cap counts whole
    # user-initiated runs, not the per-step 'agent' rows the agent loop
    # writes for each LLM call.
    tiers.mark_research_run(user["id"])

    async def event_stream():
        try:
            async for event in agent.run_research(article_id, user["id"], req.question):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/articles/{article_id}/highlights")
def list_article_highlights(article_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        rows = conn.execute(
            """SELECT id, article_id, text, note, created_at
               FROM highlights WHERE article_id = ? AND user_id = ?
               ORDER BY id ASC""",
            (article_id, user["id"]),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/articles/{article_id}/highlights")
def create_highlight(
    article_id: int, req: HighlightReq, user: dict = Depends(current_user)
):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "empty highlight")
    with db.connect() as conn:
        exists = conn.execute(
            "SELECT 1 FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user["id"]),
        ).fetchone()
        if not exists:
            raise HTTPException(404, "article not found")
        cur = conn.execute(
            "INSERT INTO highlights (user_id, article_id, text, note) VALUES (?, ?, ?, ?)",
            (user["id"], article_id, text, req.note),
        )
        hid = cur.lastrowid
        row = conn.execute(
            "SELECT id, article_id, text, note, created_at FROM highlights WHERE id = ?",
            (hid,),
        ).fetchone()
    return dict(row)


@app.delete("/api/highlights/{highlight_id}")
def delete_highlight(highlight_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        cur = conn.execute(
            "DELETE FROM highlights WHERE id = ? AND user_id = ?",
            (highlight_id, user["id"]),
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.get("/api/highlights")
def list_all_highlights(limit: int = 200, user: dict = Depends(current_user)):
    with db.connect() as conn:
        rows = conn.execute(
            """SELECT h.id, h.article_id, h.text, h.note, h.created_at,
                      a.title AS article_title, a.site_name AS article_site,
                      a.url AS article_url
               FROM highlights h
               JOIN articles a ON a.id = h.article_id
               WHERE h.user_id = ?
               ORDER BY h.id DESC LIMIT ?""",
            (user["id"], limit),
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/config")
def get_config():
    return {
        "llm_ready": config.LLM_READY,
        "enable_llm": config.ENABLE_LLM,
        "web_search_ready": config.WEB_SEARCH_READY,
        "auth_ready": config.AUTH_READY,
        "chat_model": config.COHERE_CHAT_MODEL,
        "embed_model": config.COHERE_EMBED_MODEL,
        "port": config.PORT,
    }


# Cohere list pricing, USD per 1M tokens. Update if Cohere changes prices;
# these are hardcoded so the $ estimate survives being offline.
COHERE_PRICING = {
    "command-a-03-2025": {"input": 2.50, "output": 10.00},
    "command-a": {"input": 2.50, "output": 10.00},
    "embed-english-v3.0": {"input": 0.10, "output": 0.0},
    "embed-multilingual-v3.0": {"input": 0.10, "output": 0.0},
}


def _price(model: str, input_tokens: int, output_tokens: int) -> float:
    p = COHERE_PRICING.get(model)
    if not p:
        p = {"input": 2.50, "output": 10.00}
    return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000


@app.get("/api/usage")
def get_usage(user: dict = Depends(current_user)):
    """Return Cohere token usage rollups for the current user. All times are
    compared against SQLite's CURRENT_TIMESTAMP (UTC)."""
    with db.connect() as conn:
        def rollup(window_sql: str) -> dict:
            rows = conn.execute(
                f"""SELECT endpoint, model,
                          COALESCE(SUM(input_tokens), 0) AS input_tokens,
                          COALESCE(SUM(output_tokens), 0) AS output_tokens,
                          COUNT(*) AS calls
                     FROM cohere_usage
                     WHERE user_id = ? {('AND ' + window_sql) if window_sql else ''}
                     GROUP BY endpoint, model""",
                (user["id"],),
            ).fetchall()
            by_endpoint: dict[str, dict] = {}
            total_in = total_out = total_usd = total_calls = 0
            for r in rows:
                usd = _price(r["model"], r["input_tokens"], r["output_tokens"])
                bucket = by_endpoint.setdefault(
                    r["endpoint"],
                    {"input_tokens": 0, "output_tokens": 0, "usd": 0.0, "calls": 0},
                )
                bucket["input_tokens"] += r["input_tokens"]
                bucket["output_tokens"] += r["output_tokens"]
                bucket["usd"] += usd
                bucket["calls"] += r["calls"]
                total_in += r["input_tokens"]
                total_out += r["output_tokens"]
                total_usd += usd
                total_calls += r["calls"]
            return {
                "input_tokens": total_in,
                "output_tokens": total_out,
                "usd": round(total_usd, 4),
                "calls": total_calls,
                "by_endpoint": {
                    k: {**v, "usd": round(v["usd"], 4)} for k, v in by_endpoint.items()
                },
            }

        return {
            "today": rollup("ts >= date('now', 'start of day')"),
            "month": rollup("ts >= date('now', 'start of month')"),
            "all_time": rollup(""),
            "pricing": COHERE_PRICING,
        }


# --- Serve the built frontend from the same origin (if it exists) ------------
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="assets",
    )

    FRONTEND_DIST_RESOLVED = FRONTEND_DIST.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        # Never shadow API / bookmarklet routes (FastAPI registers in order,
        # but belt-and-suspenders: reject anything api-looking here too).
        if full_path.startswith(("api/", "save", "share")):
            raise HTTPException(404)
        # Serve real files at the dist root (manifest.webmanifest,
        # apple-touch-icon.png, favicon.svg) before falling back to the SPA shell.
        if full_path:
            candidate = (FRONTEND_DIST / full_path).resolve()
            if (
                candidate.is_file()
                and candidate.is_relative_to(FRONTEND_DIST_RESOLVED)
            ):
                return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
