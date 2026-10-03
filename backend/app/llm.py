"""Pluggable text-generation provider.

Scoring, the daily brief and article summaries can run on Cohere, Anthropic,
OpenAI, or anything that speaks OpenAI's /chat/completions. Pick one with
LLM_PROVIDER; keys live in .env.

EMBEDDINGS ARE DELIBERATELY NOT HERE. Semantic search, "similar articles" and
Discover clustering all compare against embedding BLOBs already stored in the
database. Vectors from two different embedding models are not comparable, so
switching providers mid-library would silently corrupt every similarity
result. Embeddings stay on Cohere (cohere_client.embed) until someone
re-embeds the whole library on purpose.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
from typing import Any

import httpx

from . import config
from .cohere_client import record_usage

HTTP_TIMEOUT = 120.0

PROVIDERS = {
    "cohere": {
        "label": "Cohere",
        "env_key": "COHERE_API_KEY",
        "default_model": "command-a-03-2025",
    },
    "anthropic": {
        "label": "Anthropic (Claude)",
        "env_key": "ANTHROPIC_API_KEY",
        "default_model": "claude-sonnet-5-5",
        "default_strong_model": "claude-opus-5-5",
        "base_url": "https://api.anthropic.com/v1",
    },
    "openai": {
        "label": "OpenAI",
        "env_key": "OPENAI_API_KEY",
        "default_model": "gpt-5-mini",
        "default_strong_model": "gpt-5",
        "base_url": "https://api.openai.com/v1",
    },
    "openai-compatible": {
        "label": "OpenAI-compatible endpoint",
        "env_key": "OPENAI_COMPATIBLE_API_KEY",
        "default_model": "",
        "base_url": None,  # must come from LLM_BASE_URL
    },
    # Uses a locally installed, already-logged-in Claude Code CLI instead of an
    # API key. Handy on a dev machine; not available on a server, so it is
    # never chosen automatically.
    "claude-cli": {
        "label": "Local Claude Code CLI",
        "env_key": None,
        "default_model": "claude-sonnet-5-5",
        "default_strong_model": "claude-opus-5-5",
    },
}

CLI_TIMEOUT = 300.0


def _key_for(provider: str) -> str:
    env_key = PROVIDERS[provider]["env_key"]
    if not env_key:
        return ""
    return getattr(config, env_key, "") or ""


def active_provider() -> str:
    """Config wins; otherwise prefer whichever key exists, Cohere last so an
    existing install keeps working untouched."""
    choice = (config.LLM_PROVIDER or "auto").lower()
    if choice != "auto":
        if choice not in PROVIDERS:
            raise RuntimeError(f"unknown LLM_PROVIDER '{choice}'")
        return choice
    for name in ("anthropic", "openai", "cohere"):
        if _key_for(name):
            return name
    return "cohere"


def model_for(task: str = "default") -> str:
    """`task` is 'score' (high volume, cheap) or 'digest' (once a day, strong)."""
    provider = active_provider()
    spec = PROVIDERS[provider]

    override = {
        "score": config.DISCOVER_SCORE_MODEL,
        "digest": config.DISCOVER_DIGEST_MODEL,
    }.get(task)
    if override:
        return override
    if config.LLM_MODEL:
        return config.LLM_MODEL
    if task == "digest":
        return spec.get("default_strong_model") or spec["default_model"]
    return spec["default_model"]


def ready() -> bool:
    if not config.ENABLE_LLM:
        return False
    provider = active_provider()
    # A local OpenAI-compatible server legitimately needs no key.
    if provider == "openai-compatible":
        return bool(config.LLM_BASE_URL)
    if provider == "claude-cli":
        return shutil.which("claude") is not None
    return bool(_key_for(provider))


def extract_json(text: str) -> Any:
    """Models wrap JSON in prose or fences; dig the real value out."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    for opener, closer in (("{", "}"), ("[", "]")):
        start = cleaned.find(opener)
        if start == -1:
            continue
        depth = 0
        in_string = escaped = False
        for i in range(start, len(cleaned)):
            ch = cleaned[i]
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(cleaned[start:i + 1])
                    except json.JSONDecodeError:
                        break
    raise ValueError(f"no JSON found in model output: {cleaned[:200]}")


async def complete(
    prompt: str,
    system: str | None = None,
    json_mode: bool = False,
    endpoint: str = "complete",
    model: str | None = None,
    task: str = "default",
    user_id: int | None = None,
    max_tokens: int = 4096,
) -> str:
    """One-shot completion as text, whichever provider is configured."""
    if not ready():
        raise RuntimeError(
            "No LLM configured. Set one of COHERE_API_KEY / ANTHROPIC_API_KEY / "
            "OPENAI_API_KEY in .env, and ENABLE_LLM=true."
        )
    provider = active_provider()
    use_model = model or model_for(task)

    if provider == "cohere":
        text, inp, out = await _cohere(prompt, system, json_mode, use_model)
    elif provider == "claude-cli":
        text, inp, out = await _claude_cli(prompt, system, json_mode, use_model)
    elif provider == "anthropic":
        text, inp, out = await _anthropic(prompt, system, json_mode, use_model, max_tokens)
    else:
        text, inp, out = await _openai(prompt, system, json_mode, use_model, max_tokens, provider)

    record_usage(endpoint, f"{provider}:{use_model}", inp, out, user_id=user_id)
    return text


# ------------------------------------------------------------------ adapters

async def _cohere(prompt, system, json_mode, model):
    from .cohere_client import client, _extract_tokens

    messages = ([{"role": "system", "content": system}] if system else []) + [
        {"role": "user", "content": prompt}
    ]
    kwargs = {"model": model, "messages": messages}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = await client().chat(**kwargs)
    inp, out = _extract_tokens(resp)
    return resp.message.content[0].text, inp, out


async def _claude_cli(prompt, system, json_mode, model):
    """Shell out to a logged-in Claude Code CLI. No API key involved."""
    args = ["claude", "-p", "--output-format", "json", "--model", model]
    if system:
        args += ["--append-system-prompt", system]
    if json_mode:
        prompt += "\n\nRespond with a single JSON object and nothing else."

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        # Run outside any project so the CLI does not load a repo's CLAUDE.md
        # into every scoring call.
        cwd=tempfile.gettempdir(),
    )
    try:
        out_b, err_b = await asyncio.wait_for(
            proc.communicate(prompt.encode()), timeout=CLI_TIMEOUT
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError(f"claude CLI timed out after {CLI_TIMEOUT}s")

    if proc.returncode != 0:
        raise RuntimeError(f"claude CLI exited {proc.returncode}: {err_b.decode()[:300]}")
    try:
        payload = json.loads(out_b.decode())
    except json.JSONDecodeError:
        raise RuntimeError(f"unparseable claude CLI output: {out_b.decode()[:300]}")
    if payload.get("is_error"):
        raise RuntimeError(f"claude CLI: {str(payload.get('result'))[:300]}")

    usage = payload.get("usage") or {}
    return (payload.get("result") or "",
            usage.get("input_tokens", 0), usage.get("output_tokens", 0))


async def _anthropic(prompt, system, json_mode, model, max_tokens):
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        body["system"] = system
    if json_mode:
        # No response_format on this API; ask plainly and parse tolerantly.
        body["messages"][0]["content"] += "\n\nRespond with a single JSON object and nothing else."

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
        res = await http.post(
            f"{PROVIDERS['anthropic']['base_url']}/messages",
            headers={
                "x-api-key": _key_for("anthropic"),
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Anthropic {res.status_code}: {res.text[:300]}")
    data = res.json()
    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    usage = data.get("usage") or {}
    return text, usage.get("input_tokens", 0), usage.get("output_tokens", 0)


async def _openai(prompt, system, json_mode, model, max_tokens, provider):
    base = (config.LLM_BASE_URL or PROVIDERS[provider]["base_url"] or "").rstrip("/")
    if not base:
        raise RuntimeError("LLM_BASE_URL is required for an OpenAI-compatible endpoint")

    key = _key_for(provider)
    headers = {"content-type": "application/json"}
    if key:
        headers["authorization"] = f"Bearer {key}"

    messages = ([{"role": "system", "content": system}] if system else []) + [
        {"role": "user", "content": prompt}
    ]
    body: dict[str, Any] = {"model": model, "messages": messages}
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    # Newer OpenAI models require max_completion_tokens; most compatible
    # servers only know max_tokens. Try the likely one, fall back on a 400.
    order = (["max_completion_tokens", "max_tokens"] if provider == "openai"
             else ["max_tokens", "max_completion_tokens"])

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
        res = None
        for field in order:
            attempt = dict(body, **{field: max_tokens})
            res = await http.post(f"{base}/chat/completions", headers=headers, json=attempt)
            if res.status_code != 400 or "token" not in res.text.lower():
                break
    if res is None or res.status_code >= 400:
        raise RuntimeError(f"{PROVIDERS[provider]['label']} {res.status_code}: {res.text[:300]}")

    data = res.json()
    text = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    usage = data.get("usage") or {}
    return text, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
