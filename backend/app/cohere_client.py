from __future__ import annotations

import json
import struct
from typing import AsyncIterator
import cohere
from . import config


_client: cohere.AsyncClientV2 | None = None


def client() -> cohere.AsyncClientV2:
    global _client
    if _client is None:
        _client = cohere.AsyncClientV2(api_key=config.COHERE_API_KEY)
    return _client


def _truncate(text: str, max_chars: int = 20000) -> str:
    return text[:max_chars] if len(text) > max_chars else text


async def summarize_and_tag(title: str, content: str) -> dict:
    if not config.LLM_READY:
        return {"summary_short": "", "summary_long": "", "tags": []}

    prompt = f"""Analyze this article and respond with a single JSON object.

Schema:
{{
  "summary_short": "one sentence, <140 chars, engaging",
  "summary_long": "2-3 sentence TLDR covering the main points",
  "tags": ["3-6 short lowercase topic tags"]
}}

Title: {title}

Article:
{_truncate(content)}

Respond with JSON only, no prose."""

    resp = await client().chat(
        model=config.COHERE_CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    text = resp.message.content[0].text
    try:
        data = json.loads(text)
        return {
            "summary_short": str(data.get("summary_short", ""))[:300],
            "summary_long": str(data.get("summary_long", ""))[:1000],
            "tags": [str(t).lower().strip() for t in data.get("tags", [])][:8],
        }
    except Exception:
        return {"summary_short": "", "summary_long": "", "tags": []}


async def embed(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    if not config.LLM_READY or not texts:
        return [[] for _ in texts]
    resp = await client().embed(
        model=config.COHERE_EMBED_MODEL,
        texts=[_truncate(t, 8000) for t in texts],
        input_type=input_type,
        embedding_types=["float"],
    )
    return resp.embeddings.float_


async def chat_with_article_stream(
    title: str, content: str, history: list[dict], question: str
) -> AsyncIterator[str]:
    if not config.LLM_READY:
        yield "LLM is disabled. Enable it in Settings to chat with articles."
        return

    system = (
        "You are a reading assistant. Answer questions about the article below. "
        "Quote exact passages when helpful. If the article doesn't answer, say so.\n\n"
        f"# Article: {title}\n\n{_truncate(content, 30000)}"
    )
    messages = [{"role": "system", "content": system}]
    for m in history[-10:]:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": question})

    stream = client().chat_stream(
        model=config.COHERE_CHAT_MODEL,
        messages=messages,
    )
    async for event in stream:
        if event.type == "content-delta":
            delta = event.delta.message.content.text
            if delta:
                yield delta


def embedding_to_blob(vec: list[float]) -> bytes:
    if not vec:
        return b""
    return struct.pack(f"{len(vec)}f", *vec)


def blob_to_embedding(b: bytes) -> list[float]:
    if not b:
        return []
    n = len(b) // 4
    return list(struct.unpack(f"{n}f", b))


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
