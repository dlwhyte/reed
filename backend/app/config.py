import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / ".env")

COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
ENABLE_LLM = os.getenv("ENABLE_LLM", "true").lower() == "true"
COHERE_CHAT_MODEL = os.getenv("COHERE_CHAT_MODEL", "command-a-03-2025")
COHERE_EMBED_MODEL = os.getenv("COHERE_EMBED_MODEL", "embed-english-v3.0")
WEB_SEARCH_READY = bool(TAVILY_API_KEY)

PORT = int(os.getenv("PORT", "8765"))
DATA_DIR = Path(os.getenv("DATA_DIR", str(Path.home() / "ReaderData")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "reader.db"

# --- Text generation provider -------------------------------------------
# Scoring, the daily brief and summaries can run on any of these. Embeddings
# stay on Cohere regardless: stored vectors are not comparable across models.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto")        # auto|cohere|anthropic|openai|openai-compatible
LLM_MODEL = os.getenv("LLM_MODEL", "")                  # overrides the provider default
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")            # openai-compatible endpoints
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_COMPATIBLE_API_KEY = os.getenv("OPENAI_COMPATIBLE_API_KEY", "")

# Per-task overrides: scoring runs on every article, the brief runs once a day.
DISCOVER_SCORE_MODEL = os.getenv("DISCOVER_SCORE_MODEL", "")
DISCOVER_DIGEST_MODEL = os.getenv("DISCOVER_DIGEST_MODEL", "")

# Embeddings require Cohere specifically; text generation may use any provider.
EMBEDDINGS_READY = ENABLE_LLM and bool(COHERE_API_KEY)
LLM_READY = ENABLE_LLM and bool(
    COHERE_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY
    or (LLM_PROVIDER == "openai-compatible" and LLM_BASE_URL)
)

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")
AUTH_READY = bool(CLERK_JWKS_URL and CLERK_ISSUER)

# Any user whose email matches this is auto-promoted to the `admin` tier
# the first time they sign in (and on every subsequent login if their tier
# was ever demoted). Lets you bootstrap admin without an SSH session.
BOOTSTRAP_ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower() or None
