"""Research Companion Agent — tool-using loop with Cohere Command A.

Tools:
  - search_library(query): semantic search over saved articles
  - read_article(article_id): fetch a stored article's full content
  - search_web(query): Tavily web search (optional, requires TAVILY_API_KEY)
"""
from __future__ import annotations

import json
from typing import AsyncIterator
import httpx

from . import config, db, cohere_client


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_library",
            "description": (
                "Semantically search the user's saved articles. Use this first to find "
                "related pieces they've already read. Returns id, title, excerpt."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language query"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_article",
            "description": (
                "Read the full text of a specific article from the user's library. "
                "Use after search_library to get full content of a promising result."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "article_id": {"type": "integer"},
                },
                "required": ["article_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": (
                "Search the current web. Use this to find counter-arguments, recent "
                "news, or topics not yet in the user's library."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "max_results": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
]


SIMILARITY_THRESHOLD = 0.35


async def _tool_search_library(query: str, user_id: int, limit: int = 5) -> dict:
    query_vecs = await cohere_client.embed(
        [query],
        input_type="search_query",
        endpoint="agent_search_library",
        user_id=user_id,
    )
    if not query_vecs or not query_vecs[0]:
        return {"results": [], "total_library": 0, "note": "embedding failed"}
    qvec = query_vecs[0]

    with db.connect() as conn:
        rows = conn.execute(
            """SELECT id, title, site_name, url, excerpt, summary_short, embedding
               FROM articles WHERE user_id = ? AND length(embedding) > 0""",
            (user_id,),
        ).fetchall()

    scored = []
    for r in rows:
        vec = cohere_client.blob_to_embedding(r["embedding"])
        if vec:
            score = cohere_client.cosine(qvec, vec)
            scored.append((score, r))
    scored.sort(key=lambda x: x[0], reverse=True)

    strong = [(s, r) for s, r in scored if s >= SIMILARITY_THRESHOLD][:limit]
    results = [
        {
            "id": r["id"],
            "title": r["title"],
            "site_name": r["site_name"],
            "url": r["url"],
            "excerpt": (r["summary_short"] or r["excerpt"] or "")[:300],
            "similarity": round(score, 3),
        }
        for score, r in strong
    ]

    note = None
    if not results:
        if scored:
            best = round(scored[0][0], 3)
            note = (
                f"No strong matches in library (best similarity was {best}, "
                f"threshold is {SIMILARITY_THRESHOLD}). The user's saved library "
                f"({len(scored)} articles) does not cover this topic well — "
                f"consider using search_web instead."
            )
        else:
            note = "Library is empty or no embeddings available."

    return {
        "results": results,
        "total_library": len(scored),
        **({"note": note} if note else {}),
    }


async def _tool_read_article(article_id: int, user_id: int) -> dict:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT id, title, site_name, url, author, content FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user_id),
        ).fetchone()
    if not row:
        return {"error": f"No article with id {article_id}"}
    content = row["content"] or ""
    return {
        "id": row["id"],
        "title": row["title"],
        "site_name": row["site_name"],
        "url": row["url"],
        "author": row["author"],
        "content": content[:8000],
        "truncated": len(content) > 8000,
    }


async def _tool_search_web(query: str, max_results: int = 5) -> list[dict]:
    if not config.TAVILY_API_KEY:
        return [{"error": "web search disabled — TAVILY_API_KEY not set"}]
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": config.TAVILY_API_KEY,
                "query": query,
                "max_results": max_results,
                "search_depth": "advanced",
                "include_answer": False,
            },
        )
        r.raise_for_status()
        data = r.json()
    return [
        {
            "title": it.get("title", ""),
            "url": it.get("url", ""),
            "content": (it.get("content", "") or "")[:1200],
            "score": it.get("score"),
        }
        for it in data.get("results", [])
    ]


async def _run_tool(name: str, args: dict, user_id: int):
    try:
        if name == "search_library":
            return await _tool_search_library(
                args.get("query", ""), user_id, int(args.get("limit", 5))
            )
        if name == "read_article":
            return await _tool_read_article(int(args.get("article_id")), user_id)
        if name == "search_web":
            return await _tool_search_web(args.get("query", ""), int(args.get("max_results", 5)))
        return {"error": f"Unknown tool: {name}"}
    except Exception as e:
        return {"error": str(e)}


def _system_prompt(article: dict, web_available: bool) -> str:
    web_note = (
        "You may use search_web for external info."
        if web_available
        else "Web search is DISABLED — only search_library and read_article are available."
    )
    return f"""You are a research companion helping the user dig deeper into an article they're reading.

The user is currently reading this article:
Title: {article['title']}
Source: {article.get('site_name') or ''}
URL: {article['url']}

Article excerpt:
{(article.get('content') or '')[:4000]}

Your job:
- Answer the user's question thoughtfully
- Use tools to find supporting evidence, counter-arguments, and related context
- Prefer the user's library first, but BE CRITICAL of results:
    - If search_library returns "note: no strong matches", DO NOT list weak matches as if they were relevant. Acknowledge the library doesn't cover this and use search_web instead.
    - Only cite library articles if their similarity score is high AND the content is genuinely on-topic.
- Formulate specific queries based on the article's actual content (names, claims, topics), not vague phrases like "related articles".
- Plan your tool use efficiently — 3-6 tool calls is typical, avoid redundant searches.
- If you cannot find genuinely relevant information, say so plainly rather than padding with weak matches.
- {web_note}
- Be concise. Bullet points and short paragraphs.

CITATION FORMAT — MANDATORY:
- Every factual claim or title you mention MUST be cited with [1], [2], [3]... inline.
- Every numbered citation MUST appear in a "Sources:" section at the very end.
- Every Sources entry MUST include the full URL. Use this EXACT format, one per line:
    Sources:
    [1] https://full.url/path — Title of the source
    [2] https://full.url/path — Title of the source
- For web search results: use the `url` field from the search_web response.
- For library articles: use the `url` field from the search_library response.
- Never list a source without its URL. Never use bullet points for sources — only the [N] format shown above.
- If you reference a piece but have no URL, do NOT cite it."""


async def run_research(article_id: int, user_id: int, question: str) -> AsyncIterator[dict]:
    """Run the agent loop. Yields event dicts:
       {type: 'plan', text}
       {type: 'tool_call', name, args}
       {type: 'tool_result', name, result_preview}
       {type: 'delta', text}
       {type: 'done'}
       {type: 'error', message}
    """
    if not config.LLM_READY:
        yield {"type": "error", "message": "LLM disabled. Set COHERE_API_KEY and ENABLE_LLM=true."}
        return

    with db.connect() as conn:
        row = conn.execute(
            "SELECT id, title, site_name, url, content FROM articles WHERE id = ? AND user_id = ?",
            (article_id, user_id),
        ).fetchone()
    if not row:
        yield {"type": "error", "message": "Article not found"}
        return
    article = dict(row)

    messages = [
        {"role": "system", "content": _system_prompt(article, config.WEB_SEARCH_READY)},
        {"role": "user", "content": question},
    ]

    client = cohere_client.client()

    for step in range(8):
        try:
            resp = await client.chat(
                model=config.COHERE_CHAT_MODEL,
                messages=messages,
                tools=TOOLS,
            )
        except Exception as e:
            yield {"type": "error", "message": f"model error: {e}"}
            return

        inp, out = cohere_client._extract_tokens(resp)
        cohere_client.record_usage(
            "agent", config.COHERE_CHAT_MODEL, inp, out, user_id=user_id
        )

        msg = resp.message
        tool_calls = getattr(msg, "tool_calls", None) or []

        if tool_calls:
            if getattr(msg, "tool_plan", None):
                yield {"type": "plan", "text": msg.tool_plan}

            assistant_msg = {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls
                ],
                "tool_plan": getattr(msg, "tool_plan", "") or "",
            }
            messages.append(assistant_msg)

            for tc in tool_calls:
                name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments)
                except Exception:
                    args = {}
                yield {"type": "tool_call", "name": name, "args": args}

                result = await _run_tool(name, args, user_id)
                preview = json.dumps(result)[:500]
                yield {"type": "tool_result", "name": name, "result_preview": preview}

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": [
                            {
                                "type": "document",
                                "document": {"data": json.dumps(result)[:20000]},
                            }
                        ],
                    }
                )
            continue

        text = msg.content[0].text if msg.content else ""
        if text:
            chunk = 80
            for i in range(0, len(text), chunk):
                yield {"type": "delta", "text": text[i : i + chunk]}
        yield {"type": "done"}
        return

    yield {"type": "error", "message": "Agent did not converge in 8 steps."}
