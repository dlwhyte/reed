# Working in reed / BrowseFellow

Short orientation for Claude Code sessions in this repo.

## What it is

A Mac-hosted, local-first read-it-later app. FastAPI backend + SQLite (FTS5) + Cohere LLM + React/Vite/Tailwind frontend served by the backend on `:8765`. See `README.md` for the user-facing overview.

## Run it

```bash
./backend/run.sh              # venv, deps, uvicorn on :8765
cd frontend && npm run build  # needed when frontend changes are not live-reloaded
cd frontend && npm run dev    # vite on :5173 for hot reload
```

The backend is usually running under `launchd` (`com.user.reader`). To pick up backend code changes:

```bash
launchctl kickstart -k "gui/$UID/com.user.reader"
```

## Test it

```bash
cd backend && pytest
```

66 tests (split across `test_api.py`, `test_agent_api.py`, `test_security.py`, `test_tiers.py`), well under a second, no network, uses a temp SQLite via fixtures in `backend/tests/conftest.py`. Add new tests here before assuming a change works. CI (`.github/workflows/ci.yml`) runs the same suite plus `pip-audit`, `npm audit`, `gitleaks`, and CodeQL on every push.

For the MCP server, tests live in `mcp-server/test/*.test.mjs` (Node built-in runner, no extra deps). Run with `cd mcp-server && npm test`.

## Where things live

- `backend/app/main.py` — FastAPI routes. Single file, easy to read start-to-finish.
- `backend/app/db.py` — SQLite schema + `connect()` context manager. All DB access goes through this.
- `backend/app/cohere_client.py` — all Cohere calls. Usage tracking hooks live here too — any new Cohere call site should end with `record_usage(endpoint, model, in, out)`.
- `backend/app/agent.py` — the research-agent tool loop.
- `backend/app/extractor.py` — trafilatura wrapper with a 5 MiB / 5-redirect cap.
- `frontend/src/pages/` — Library, Reader, Settings, Tags, Highlights.
- `frontend/src/lib/api.ts` — typed fetch client for every endpoint.
- `extension/` — Chrome extension (Manifest V3). Points at `http://localhost:8765`. **Don't rewrite this URL here** — use `scripts/build-friend-extension.sh <url>` to produce a URL-rebranded zip under `dist/extensions/`.
- `mcp-server/` — `@browsefellow/mcp`, the MCP server wrapping the token-gated `/api/agent/*` endpoints. Three tools: `search_library`, `get_article`, `search_highlights`. Used by Claude Desktop, Cursor, ChatGPT Connectors, and this repo's own Claude Code session.
- `docs/` — distribution docs: `openapi-agent.yaml` (agent API schema), `NPM-PUBLISH.md`, `CUSTOM-GPT-SETUP.md`, `CUSTOM-GPT-INSTRUCTIONS.md`, `CWS-LISTING.md`, `PRIVACY.md`.
- `frontend/public/mcp.html` + `Settings.tsx` MCP panel — the in-app `/mcp` landing page and per-client install snippets (Claude Desktop / Cursor / ChatGPT).
- `scripts/` — `install-launchd.sh`, `uninstall-launchd.sh`, `build-friend-extension.sh`. All paths are derived from `$SCRIPT_DIR` — don't hardcode absolute paths.

## Conventions / house rules

- **Data lives in `~/ReaderData/reader.db`**, not in the repo. `dist/`, `node_modules/`, venvs, iOS build artifacts, and the DB are all gitignored. Don't commit them.
- **Don't commit `.env`** — keys load from there at startup. `.env.example` has the shape.
- **Tests before ship.** If a change touches an endpoint, extend `backend/tests/test_api.py`. If it surfaces a bug, add a test that fails, then fix.
- **Security-relevant routes** (`/api/save`, `/save`, `/share`) already have SSRF guards, XSS escaping, URL-length caps, and origin allowlists. Don't weaken these without a clear reason.
- **Dependencies**: keep `pip-audit` and `npm audit` clean at the CI threshold (critical for npm, any for pip). If a CVE lands, either bump or add an explicit `|| true` with a one-line comment explaining why.
- **Frontend rebuild**: `frontend/dist/` is served by the backend. After frontend changes, `npm run build` in `frontend/`. The backend serves the new assets on the next request — no backend restart needed.
- **Launchd service** (`com.user.reader.plist`) must keep paths derived from `$SCRIPT_DIR` / `$REED_ROOT` — see the commit history if templating breaks.

## Follow-ups

Open work lives in `TODO.md` at the repo root. Check there before proposing "next steps" — if it's already listed, reference the existing entry rather than re-proposing.

## Things to avoid

- Don't assume Cohere is available in tests — `ENABLE_LLM=false` is set by the test fixture and Cohere calls are never made from CI.
- Don't commit large build artifacts or iOS Xcode output.
- Don't change `extension/manifest.json` host_permissions to something other than `http://localhost:8765/*` — that's the canonical personal-use config. Friend versions are built, not committed.
- Don't swap `db.connect()` for a raw `sqlite3.connect(config.DB_PATH)` — `db.py` imports `DB_PATH` at module load and the two can drift under monkeypatching (this already bit us once; see commit 68bdc77).
