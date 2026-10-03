"""Provider selection, model choice and tolerant JSON parsing."""
from __future__ import annotations

import pytest

from app import config, llm


def _keys(monkeypatch, *, cohere="", anthropic="", openai="",
          provider="auto", model="", base_url=""):
    monkeypatch.setattr(config, "COHERE_API_KEY", cohere)
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", anthropic)
    monkeypatch.setattr(config, "OPENAI_API_KEY", openai)
    monkeypatch.setattr(config, "OPENAI_COMPATIBLE_API_KEY", "")
    monkeypatch.setattr(config, "LLM_PROVIDER", provider)
    monkeypatch.setattr(config, "LLM_MODEL", model)
    monkeypatch.setattr(config, "LLM_BASE_URL", base_url)
    monkeypatch.setattr(config, "DISCOVER_SCORE_MODEL", "")
    monkeypatch.setattr(config, "DISCOVER_DIGEST_MODEL", "")
    monkeypatch.setattr(config, "ENABLE_LLM", True)


# ------------------------------------------------------- provider selection

def test_auto_prefers_anthropic_then_openai_then_cohere(monkeypatch):
    _keys(monkeypatch, cohere="c", anthropic="a", openai="o")
    assert llm.active_provider() == "anthropic"

    _keys(monkeypatch, cohere="c", openai="o")
    assert llm.active_provider() == "openai"

    _keys(monkeypatch, cohere="c")
    assert llm.active_provider() == "cohere"


def test_auto_falls_back_to_cohere_so_existing_installs_keep_working(monkeypatch):
    _keys(monkeypatch)
    assert llm.active_provider() == "cohere"


def test_explicit_provider_overrides_available_keys(monkeypatch):
    _keys(monkeypatch, cohere="c", anthropic="a", provider="cohere")
    assert llm.active_provider() == "cohere"


def test_unknown_provider_is_rejected(monkeypatch):
    _keys(monkeypatch, provider="llamafile")
    with pytest.raises(RuntimeError, match="unknown LLM_PROVIDER"):
        llm.active_provider()


# ----------------------------------------------------------- model choice

def test_digest_gets_the_stronger_model(monkeypatch):
    _keys(monkeypatch, anthropic="a")
    assert llm.model_for("score") == "claude-sonnet-5-5"
    assert llm.model_for("digest") == "claude-opus-5-5"


def test_per_task_override_wins(monkeypatch):
    _keys(monkeypatch, anthropic="a")
    monkeypatch.setattr(config, "DISCOVER_SCORE_MODEL", "claude-haiku-4-5-20251001")
    assert llm.model_for("score") == "claude-haiku-4-5-20251001"
    assert llm.model_for("digest") == "claude-opus-5-5", "override is per task"


def test_global_model_override(monkeypatch):
    _keys(monkeypatch, anthropic="a", model="some-model")
    assert llm.model_for("score") == "some-model"
    assert llm.model_for("digest") == "some-model"


# ---------------------------------------------------------------- readiness

def test_not_ready_without_a_key(monkeypatch):
    _keys(monkeypatch)
    assert llm.ready() is False


def test_not_ready_when_llm_disabled(monkeypatch):
    _keys(monkeypatch, anthropic="a")
    monkeypatch.setattr(config, "ENABLE_LLM", False)
    assert llm.ready() is False


def test_local_compatible_endpoint_needs_no_key(monkeypatch):
    _keys(monkeypatch, provider="openai-compatible", base_url="http://localhost:11434/v1")
    assert llm.ready() is True


def test_compatible_endpoint_without_a_url_is_not_ready(monkeypatch):
    _keys(monkeypatch, provider="openai-compatible")
    assert llm.ready() is False


# ------------------------------------------------------------- json parsing

@pytest.mark.parametrize(
    "raw,expected",
    [
        ('{"a": 1}', {"a": 1}),
        ('```json\n{"a": 2}\n```', {"a": 2}),
        ('```\n{"a": 3}\n```', {"a": 3}),
        ('Sure! Here you go:\n{"a": 4}\nHope that helps.', {"a": 4}),
        ('[{"n": 1}]', [{"n": 1}]),
        ('prose {"s": "has } brace"} more', {"s": "has } brace"}),
    ],
)
def test_extract_json_tolerates_wrapping(raw, expected):
    assert llm.extract_json(raw) == expected


def test_extract_json_raises_on_nothing_parseable():
    with pytest.raises(ValueError, match="no JSON found"):
        llm.extract_json("the model declined to answer")


# --------------------------------------------------------------- embeddings

def test_embeddings_stay_on_cohere_regardless_of_text_provider():
    """Stored vectors are not comparable across embedding models, so the
    text provider must never affect which embedder is used."""
    import inspect
    source = inspect.getsource(llm)
    assert "def embed" not in source, "llm.py must not offer embeddings"
    assert "EMBEDDINGS ARE DELIBERATELY NOT HERE" in source
