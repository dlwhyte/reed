from __future__ import annotations

import re
import httpx
import trafilatura
from trafilatura.settings import use_config


_config = use_config()
_config.set("DEFAULT", "EXTRACTION_TIMEOUT", "20")

# Cap the number of redirects and body size we'll follow/read. A redirect loop
# or 100MB page would otherwise stall the event loop and eat memory.
_MAX_REDIRECTS = 5
_MAX_BYTES = 5 * 1024 * 1024  # 5 MiB


async def fetch_html(url: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/125.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
    }
    async with httpx.AsyncClient(
        follow_redirects=True,
        max_redirects=_MAX_REDIRECTS,
        timeout=20.0,
        headers=headers,
    ) as client:
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            async for chunk in r.aiter_bytes():
                total += len(chunk)
                if total > _MAX_BYTES:
                    raise httpx.HTTPError("response exceeded 5 MiB cap")
                chunks.append(chunk)
            body = b"".join(chunks)
            encoding = r.charset_encoding or "utf-8"
            try:
                return body.decode(encoding, errors="replace")
            except LookupError:
                return body.decode("utf-8", errors="replace")


def extract(html: str, url: str) -> dict:
    meta = trafilatura.extract_metadata(html, default_url=url)
    text = trafilatura.extract(
        html,
        url=url,
        include_comments=False,
        include_tables=True,
        include_images=False,
        favor_precision=True,
        config=_config,
    ) or ""

    words = len(re.findall(r"\w+", text))
    read_time = max(1, round(words / 225))
    excerpt = (text[:280] + "…") if len(text) > 280 else text

    return {
        "title": (meta.title if meta else None) or _fallback_title(html) or url,
        "author": meta.author if meta else None,
        "site_name": meta.sitename if meta else _domain(url),
        "published": str(meta.date) if meta and meta.date else None,
        "content": text,
        "excerpt": excerpt,
        "image_url": meta.image if meta else None,
        "word_count": words,
        "read_time_min": read_time,
    }


def _fallback_title(html: str) -> str | None:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    return m.group(1).strip() if m else None


def _domain(url: str) -> str:
    m = re.match(r"https?://([^/]+)", url)
    return m.group(1) if m else ""
