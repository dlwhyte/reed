# BrowseFellow

[![CI](https://github.com/dlwhyte/reed/actions/workflows/ci.yml/badge.svg)](https://github.com/dlwhyte/reed/actions/workflows/ci.yml)

A warm, editorial read-it-later app that runs on your Mac. Pocket-style clean reader with a **Cohere-powered research agent** that can search your shelf, read saved articles, and browse the web to dig into whatever you're reading.

## Why

Pocket shut down in July 2025. BrowseFellow is a local-first replacement: your data lives in a single SQLite file on your Mac, never leaves, and the app keeps working even without an internet connection or LLM API key.

## Features

**Reader**
- Save any URL → clean article extraction (trafilatura)
- Three reader themes (paper / sepia / dusk), serif or sans, adjustable size + column width
- Terracotta scroll-progress rule, "N min left" indicator, scroll position persisted across sessions and devices
- In-place text-selection highlights, stored in SQLite and exportable as Markdown or JSON
- Keyboard shortcuts (`- + f a t c r ? gl gh`), press `?` for the cheat sheet

**Library**
- Unread / favorites / archived / all tabs, sortable
- Mixed / Cards / List density (persisted)
- Tag rail with live filtering, shareable `/?tag=<name>` URLs
- Inline tag editor in the Reader with autocomplete across your shelf
- Keyword + semantic search (Cohere Embed v3) with an instant `⌘K` command palette
- Editorial empty state, paper-toned loading skeletons

**LLM (Cohere)**
- Auto-summary (1-line + TL;DR) and auto-tags on save
- Chat with any article — streaming, paragraph-cited
- "Similar articles" via embedding cosine with similarity threshold
- Local token counter in **Settings → Cohere usage** — today / this month / all-time, broken down by feature, with a $ estimate so there are no billing surprises

**Research Companion agent**
- Tool-using loop on Command A: `search_library`, `read_article`, `search_web`
- Live trace: plan → tool calls → results → synthesized answer
- Inline `[n]` citations that link to a Sources list
- Optional web search via Tavily (free tier)

**Save from anywhere**
- Desktop bookmarklet (Settings → Bookmarklet)
- Chrome extension (toolbar icon + right-click context menu, `extension/`). For friends who access *your* instance via Tailscale / `browsefellow.com`, build a URL-rebranded zip with `scripts/build-friend-extension.sh <your-url>`.
- iOS Shortcut for the Share Sheet (step-by-step guide in Settings)
- **Import from Pocket** — drag a CSV export into Settings; BrowseFellow preserves tags and mirrors archived status

**Ops**
- Single URL (`http://localhost:8765`) — backend serves built frontend
- `launchd` plist for always-on (auto-start on login, auto-restart on crash)
- Zero third-party runtime dependencies besides Cohere + optional Tavily

## Stack

- **Backend**: FastAPI + SQLite (+ FTS5) + trafilatura + Cohere Python SDK
- **Frontend**: Vite + React 18 + TypeScript + Tailwind (token-driven BrowseFellow theme)
- **Mobile**: Capacitor wrapper for iOS
- **Data**: `~/ReaderData/reader.db` (single file, easy to back up)

## Setup

```bash
git clone https://github.com/dlwhyte/reed.git browsefellow
cd browsefellow

# 1. API keys
cp .env.example .env
# edit .env:
# COHERE_API_KEY=...  (required for LLM features; dashboard.cohere.com)
# TAVILY_API_KEY=...  (optional; tavily.com free tier enables web search)

# 2. Build the frontend (produces frontend/dist/ which the backend serves)
cd frontend
npm install
npm run build
cd ..

# 3. First run — creates venv, installs deps, starts server
./backend/run.sh
```

Open **http://localhost:8765**.

### Dev mode (hot reload)

Run the backend and a separate Vite dev server:

```bash
./backend/run.sh                # terminal A — :8765
cd frontend && npm run dev      # terminal B — :5173 (proxies /api to :8765)
```

Open **http://localhost:5173**.

### Python 3.9 note

BrowseFellow runs cleanly on macOS's stock Python (currently 3.9). The code uses modern type-union syntax (`str | None`), which 3.9 handles via `from __future__ import annotations` + `eval_type_backport` — both already wired up, no setup needed.

### Tests

Backend has a pytest suite covering save / list / patch / delete, FTS5 search, highlights, usage rollups, CORS allow/deny, SSRF guard, XSS escape, and the Cohere token-extraction helper:

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

All 18 tests run in under a second against a temp SQLite — no network, no Cohere calls. The same suite plus `pip-audit`, `npm audit`, `gitleaks`, and CodeQL runs on every push via GitHub Actions (see [CI](.github/workflows/ci.yml)).

Deferred work is tracked in [`TODO.md`](TODO.md).

## Run on a fresh Mac

On a different machine, after `git clone`:

1. Install Node.js (`brew install node`) if it isn't already.
2. Recreate `.env` from `.env.example` — your Cohere/Tavily keys aren't committed.
3. Run the three-step setup above.

The SQLite shelf is also gitignored, so the new Mac starts empty. To move saved articles over, copy `~/ReaderData/reader.db` by hand (or use the Pocket import path for a clean reset).

If you use the **iOS Capacitor build** from the new Mac, note that `frontend/src/lib/api.ts` has a hard-coded Tailscale hostname (`DEFAULT_NATIVE_BASE`) that points at the original machine. Either change it there, or override at runtime from the iOS web view:

```js
localStorage.setItem("reed.backend", "http://<your-mac>:8765");
```

## Always-on (launchd)

Run the backend automatically on Mac login, restart on crash, never think about it again:

```bash
./scripts/install-launchd.sh
```

Backend answers at `http://localhost:8765` whenever your Mac is on. Logs: `./logs/reader.{out,err}.log`. Stop / uninstall: `./scripts/uninstall-launchd.sh`.

## Chrome extension

Lives in `extension/`. Install unpacked — no store needed:

```bash
# One-time: generate icons from the favicon
brew install librsvg
mkdir -p extension/icons
rsvg-convert -w 16 -h 16 frontend/public/favicon.svg -o extension/icons/icon16.png
rsvg-convert -w 32 -h 32 frontend/public/favicon.svg -o extension/icons/icon32.png
rsvg-convert -w 48 -h 48 frontend/public/favicon.svg -o extension/icons/icon48.png
rsvg-convert -w 128 -h 128 frontend/public/favicon.svg -o extension/icons/icon128.png
```

Then open `chrome://extensions`, toggle **Developer mode**, click **Load unpacked**, select the `extension/` folder.

## Project layout

```
browsefellow/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI routes + SPA serving
│   │   ├── db.py              # SQLite schema, FTS5 triggers
│   │   ├── extractor.py       # trafilatura-based article extraction
│   │   ├── cohere_client.py   # Cohere calls: chat, embed, stream
│   │   ├── agent.py           # research agent: tool defs + loop
│   │   └── config.py
│   ├── requirements.txt
│   └── run.sh
├── extension/                 # Chrome extension (popup + background)
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/             # Library, Reader, Settings, Tags, Highlights
│       ├── components/
│       │   ├── primitives/    # Wordmark, Icon, TabPill, TagChip, Cite, …
│       │   ├── reader/        # HighlightLayer, TagEditor, ShortcutsHelp, …
│       │   ├── panels/        # shared Composer
│       │   └── CommandPalette.tsx, LibrarySkeleton.tsx, PocketImport.tsx, …
│       ├── lib/               # api, tokens, pocketImport, exportHighlights, hooks
│       └── store.ts
├── design_handoff_browsefellow/   # original design reference (HTML + JSX prototypes)
├── scripts/                       # launchd install/uninstall
├── .env.example
└── .gitignore
```

## Disable LLM features

Set `ENABLE_LLM=false` in `.env` or leave `COHERE_API_KEY` empty. Reader keeps working — only summaries, auto-tags, chat, semantic search, and research agent are skipped.

## License

MIT — see [LICENSE](LICENSE).
