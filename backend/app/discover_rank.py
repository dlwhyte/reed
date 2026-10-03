"""Discover: score feed items against a reader's profile, and write the brief.

The scoring rubric and the brief's voice are the judgement in this module; the
model call itself goes through cohere_client.complete, which is the one seam
to swap if another provider is wired in later.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from . import cohere_client
from .db import connect

SCORE_BATCH = 12
SCORE_CONCURRENCY = 3
SCORE_ATTEMPTS = 3

DEFAULT_PROFILE = {
    "role": "A technology leader tracking generative AI, agentic AI, and cybersecurity.",
    "interests": [],
    "mute": [],
    "half_life_hours": 72.0,
    "hide_below": 25,
    "digest_items": 12,
    "digest_min_score": 55,
}

SCORE_SYSTEM = """You are the relevance engine for one person's private research reader.
You score articles 0-100 for how much THIS person needs to see them today.

Rubric:
  90-100  Must-read. Materially changes how they think or what they do this week.
  70-89   High value. Substantive research, a real capability shift, a live exploited
          vulnerability, a significant release, or sharp analysis in their core areas.
  50-69   Worth a scan. Relevant but incremental, or good background.
  30-49   Marginal. Adjacent topic, thin content, or mostly rehash.
  0-29    Noise. Marketing, listicles, funding-round churn, pop-culture AI takes,
          vendor PR with no technical substance, or off-topic entirely.

Be harsh. A feed where everything scores 70+ is useless. Most items are 30-60.
Reward primary sources (papers, advisories, release notes, first-party engineering
writeups) over coverage-of-coverage. Punish rewrites of press releases.
Judge the article, not the brand: a strong post on a small blog beats a weak one
on a famous site.

Some feeds publish under templated titles — a CISA catalogue addition, a daily
podcast. Judge those on the body, and say in the reason what actually changed,
naming the CVE or product, so the title's sameness does not hide the content."""

DIGEST_SYSTEM = """You write one person's private morning intelligence brief on AI and security.

Voice: a sharp analyst briefing a peer who is short on time. Direct, concrete,
no hype, no hedging, no "in today's fast-moving landscape" throat-clearing.
Never pad. If a quiet day has little worth reading, say so in one line rather
than inflating three weak items into a theme.

Structure your output as GitHub-flavored Markdown:
  - Open with "## The one thing" — a single short paragraph on the most consequential
    item, and why it matters to them specifically.
  - Then 2-4 "## <Theme>" sections grouping the rest by what is actually going on
    (not by source, and not by the generic topic buckets). Write a real heading that
    states the development, e.g. "## Agent frameworks converge on typed tool calls".
  - Under each theme, 2-5 bullets. Each bullet: one sentence of substance, then the
    source link in markdown, where the link text is the OUTLET'S NAME, never the
    literal word "Source". For example:
      Fortinet shipped no patch for the exploited FortiMail flaw. ([BleepingComputer](url))
    When several outlets cover one story, link them all in the same brackets.
  - Close with "## Worth a glance" — a compact bulleted list of remaining links, one
    line each, no commentary beyond a few words, again named by outlet.

Group by what is actually happening. A heading like "AI security and model releases"
is a grab-bag, not a theme; split it or drop the weaker half.

Only use the articles given. Never invent a fact, a number, or a link.
Refer to articles by what they say, not by their item numbers."""


# ------------------------------------------------------------------ profile

def load_profile(user_id: int) -> dict:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM discover_profile WHERE user_id = ?", (user_id,)
        ).fetchone()
    if not row:
        return dict(DEFAULT_PROFILE)

    profile = dict(DEFAULT_PROFILE)
    profile.update({
        "role": row["role"] or DEFAULT_PROFILE["role"],
        "interests": json.loads(row["interests"] or "[]"),
        "mute": json.loads(row["mute"] or "[]"),
        "half_life_hours": row["half_life_hours"] or DEFAULT_PROFILE["half_life_hours"],
        "hide_below": row["hide_below"] if row["hide_below"] is not None else DEFAULT_PROFILE["hide_below"],
        "digest_items": row["digest_items"] or DEFAULT_PROFILE["digest_items"],
        "digest_min_score": row["digest_min_score"] or DEFAULT_PROFILE["digest_min_score"],
    })
    return profile


def save_profile(user_id: int, **fields) -> None:
    current = load_profile(user_id)
    current.update({k: v for k, v in fields.items() if v is not None})
    with connect() as conn:
        conn.execute(
            """INSERT INTO discover_profile
                 (user_id, role, interests, mute, half_life_hours, hide_below,
                  digest_items, digest_min_score, updated_at)
               VALUES (?,?,?,?,?,?,?,?, datetime('now'))
               ON CONFLICT(user_id) DO UPDATE SET
                 role = excluded.role, interests = excluded.interests,
                 mute = excluded.mute, half_life_hours = excluded.half_life_hours,
                 hide_below = excluded.hide_below, digest_items = excluded.digest_items,
                 digest_min_score = excluded.digest_min_score,
                 updated_at = datetime('now')""",
            (user_id, current["role"], json.dumps(current["interests"]),
             json.dumps(current["mute"]), current["half_life_hours"],
             current["hide_below"], current["digest_items"], current["digest_min_score"]),
        )


def _taste(user_id: int) -> str:
    """Saved and highlighted articles are the strongest signal of real interest —
    the thing a standalone feed reader cannot see."""
    with connect() as conn:
        saved = [r["title"] for r in conn.execute(
            """SELECT title FROM articles
                WHERE user_id = ? AND (is_favorite = 1 OR read_at IS NOT NULL)
                ORDER BY COALESCE(read_at, created_at) DESC LIMIT 12""",
            (user_id,),
        ).fetchall()]
        highlighted = [r["title"] for r in conn.execute(
            """SELECT DISTINCT a.title FROM highlights h
                 JOIN articles a ON a.id = h.article_id
                WHERE a.user_id = ? ORDER BY h.id DESC LIMIT 12""",
            (user_id,),
        ).fetchall()]
        dismissed = [r["title"] for r in conn.execute(
            """SELECT title FROM feed_items
                WHERE user_id = ? AND dismissed_at IS NOT NULL
                ORDER BY dismissed_at DESC LIMIT 12""",
            (user_id,),
        ).fetchall()]

    out = ""
    if highlighted:
        out += "\nThey highlighted passages in these, so these hit the mark:\n"
        out += "\n".join(f"  ++ {t}" for t in highlighted) + "\n"
    if saved:
        out += "\nThey saved or read these:\n" + "\n".join(f"  + {t}" for t in saved) + "\n"
    if dismissed:
        out += "\nThey dismissed these unread:\n" + "\n".join(f"  - {t}" for t in dismissed) + "\n"
    return out


# ------------------------------------------------------------------ scoring

def _score_prompt(profile: dict, taste: str, batch: list[dict]) -> str:
    interests = (
        "\nThey care specifically about:\n" + "\n".join(f"  • {i}" for i in profile["interests"]) + "\n"
        if profile["interests"] else ""
    )
    mute = (
        "\nThey do NOT want (score these under 25):\n" + "\n".join(f"  • {i}" for i in profile["mute"]) + "\n"
        if profile["mute"] else ""
    )
    items = "\n\n".join(
        f"[{n + 1}] {it['title']}\n"
        f"    source: {it['feed_title'] or 'unknown'} ({it['topic']})\n"
        f"    {(it['excerpt'] or '(no summary)')[:400]}"
        for n, it in enumerate(batch)
    )
    return f"""Reader profile: {profile['role']}
{interests}{mute}{taste}
Score each article below.

{items}

Respond with ONLY a JSON object of the form:
{{"scores":[{{"n":1,"score":0-100,"reason":"<max 18 words, concrete, says why it matters or why not>","tags":["<1-3 short topic tags>"]}}]}}"""


async def score_pending(user_id: int, limit: int = 200) -> dict:
    """Score unscored feed items in batches. One failed batch does not stop the rest."""
    profile = load_profile(user_id)
    taste = _taste(user_id)

    with connect() as conn:
        pending = [dict(r) for r in conn.execute(
            """SELECT i.id, i.title, i.excerpt, f.title AS feed_title, f.topic
                 FROM feed_items i JOIN feeds f ON f.id = i.feed_id
                WHERE i.user_id = ? AND i.scored_at IS NULL
                ORDER BY i.published DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()]
    if not pending:
        return {"scored": 0, "batches": 0, "failed": 0}

    batches = [pending[i:i + SCORE_BATCH] for i in range(0, len(pending), SCORE_BATCH)]
    sem = asyncio.Semaphore(SCORE_CONCURRENCY)
    scored = failed = 0
    errors: list[str] = []

    async def run(batch: list[dict]):
        nonlocal scored, failed
        async with sem:
            rows = None
            last_exc = None
            # Rate limits are routine (trial keys especially) and transient;
            # one 429 should not leave a dozen articles permanently unscored.
            for attempt in range(SCORE_ATTEMPTS):
                try:
                    text = await cohere_client.complete(
                        _score_prompt(profile, taste, batch),
                        system=SCORE_SYSTEM, json_mode=True,
                        endpoint="discover_score", user_id=user_id,
                    )
                    rows = json.loads(text).get("scores", [])
                    break
                except Exception as exc:  # noqa: BLE001
                    last_exc = exc
                    if attempt < SCORE_ATTEMPTS - 1:
                        await asyncio.sleep(2 ** attempt)

            if rows is None:
                failed += 1
                # Swallowing the reason makes a silently half-scored feed look
                # healthy; keep it so callers and logs can see what went wrong.
                errors.append(f"{type(last_exc).__name__}: {last_exc}"[:200])
                return

            with connect() as conn:
                for row in rows:
                    try:
                        item = batch[int(row["n"]) - 1]
                    except (KeyError, ValueError, IndexError, TypeError):
                        continue
                    score = max(0, min(100, int(round(float(row.get("score") or 0)))))
                    tags = row.get("tags") or []
                    conn.execute(
                        """UPDATE feed_items SET score = ?, score_reason = ?, score_tags = ?,
                             scored_at = datetime('now'), score_model = ? WHERE id = ?""",
                        (score, str(row.get("reason", ""))[:240],
                         json.dumps([str(t) for t in tags][:3]),
                         "cohere", item["id"]),
                    )
                    scored += 1

    await asyncio.gather(*(run(b) for b in batches))
    return {"scored": scored, "batches": len(batches), "failed": failed,
            "errors": errors[:5]}


# ------------------------------------------------------------------- ranking

def ranked_items(user_id: int, limit: int = 60, topic: str | None = None,
                 hours: int = 96, min_score: int | None = None) -> list[dict]:
    """Score decayed by age and weighted by source, one row per story cluster."""
    profile = load_profile(user_id)
    floor = profile["hide_below"] if min_score is None else min_score

    sql = """
      WITH pool AS (
        SELECT i.*, f.title AS feed_title, f.topic, f.site_url,
               (COALESCE(i.score, 40) * f.weight *
                pow(0.5, (julianday('now') - julianday(i.published)) * 24.0 / :half_life)
               ) AS rank_score,
               (SELECT COUNT(*) FROM feed_items s
                 WHERE s.cluster_id = i.cluster_id AND s.user_id = i.user_id) AS cluster_size
          FROM feed_items i JOIN feeds f ON f.id = i.feed_id
         WHERE i.user_id = :uid
           AND i.dismissed_at IS NULL
           AND i.published > datetime('now', :window)
           AND (i.score IS NULL OR i.score >= :floor)
           {topic_clause}
      ),
      deduped AS (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY COALESCE(cluster_id, -id) ORDER BY rank_score DESC, published DESC
        ) AS rn FROM pool
      )
      SELECT * FROM deduped WHERE rn = 1 ORDER BY rank_score DESC, published DESC LIMIT :limit
    """.replace("{topic_clause}", "AND f.topic = :topic" if topic and topic != "all" else "")

    params = {"uid": user_id, "half_life": profile["half_life_hours"],
              "window": f"-{hours} hours", "floor": floor, "limit": limit}
    if topic and topic != "all":
        params["topic"] = topic

    with connect() as conn:
        rows = [dict(r) for r in conn.execute(sql, params).fetchall()]

    for r in rows:
        r.pop("embedding", None)  # not JSON-serialisable and of no use to a client
        r["score_tags"] = json.loads(r.get("score_tags") or "[]")
        r["rank_score"] = round(r["rank_score"] or 0)
    return rows


# -------------------------------------------------------------------- digest

async def build_digest(user_id: int, day: str | None = None, force: bool = False) -> dict:
    day = day or datetime.now(timezone.utc).date().isoformat()
    profile = load_profile(user_id)

    with connect() as conn:
        existing = conn.execute(
            "SELECT * FROM digests WHERE user_id = ? AND day = ?", (user_id, day)
        ).fetchone()
    if existing and not force:
        return {**dict(existing), "cached": True}

    items = ranked_items(user_id, limit=profile["digest_items"], hours=26,
                         min_score=profile["digest_min_score"])

    if not items:
        markdown = (
            f"## Quiet day\n\nNothing cleared a score of {profile['digest_min_score']} "
            "in the last 26 hours."
        )
        model = "none"
    else:
        body = "\n\n".join(
            f"[{n + 1}] {it['title']}\n"
            f"    url: {it['url']}\n"
            f"    source: {it['feed_title']} · {it['topic']} · score {it['score']}"
            + (f" · covered by {it['cluster_size']} sources" if (it['cluster_size'] or 0) > 1 else "")
            + f"\n    why it scored: {it.get('score_reason') or ''}"
              f"\n    {(it['excerpt'] or '')[:600]}"
            for n, it in enumerate(items)
        )
        markdown = (await cohere_client.complete(
            f"""Reader: {profile['role']}
Their stated interests: {'; '.join(profile['interests']) or 'general AI and security'}

Today is {day}. Here are the {len(items)} highest-signal articles from the last 26 hours.

{body}

Write the brief.""",
            system=DIGEST_SYSTEM, endpoint="discover_digest", user_id=user_id,
        )).strip()
        model = "cohere"

    with connect() as conn:
        conn.execute(
            """INSERT INTO digests (user_id, day, markdown, model, item_count)
               VALUES (?,?,?,?,?)
               ON CONFLICT(user_id, day) DO UPDATE SET
                 markdown = excluded.markdown, model = excluded.model,
                 item_count = excluded.item_count, created_at = datetime('now')""",
            (user_id, day, markdown, model, len(items)),
        )
    return {"day": day, "markdown": markdown, "model": model, "item_count": len(items)}
