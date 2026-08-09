import os
from pathlib import Path
from dotenv import load_dotenv

# reed/ repo root — same .env BrowseFellow uses, so CLERK_JWKS_URL/CLERK_ISSUER
# (same Clerk instance) are shared automatically with no duplicated secrets.
ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT / ".env")

PORT = int(os.getenv("NOTES_PORT", "8766"))
NOTES_DATA_DIR = Path(os.getenv("NOTES_DATA_DIR", str(Path.home() / "NotesData")))
NOTES_DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = NOTES_DATA_DIR / "notes.db"

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")
AUTH_READY = bool(CLERK_JWKS_URL and CLERK_ISSUER)
