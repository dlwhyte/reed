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

LLM_READY = ENABLE_LLM and bool(COHERE_API_KEY)

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")
AUTH_READY = bool(CLERK_JWKS_URL and CLERK_ISSUER)

# Any user whose email matches this is auto-promoted to the `admin` tier
# the first time they sign in (and on every subsequent login if their tier
# was ever demoted). Lets you bootstrap admin without an SSH session.
BOOTSTRAP_ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower() or None
