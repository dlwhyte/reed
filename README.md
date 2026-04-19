# reed

A personal read-it-later app that runs on your Mac. Pocket-style clean reader with a **Cohere-powered research agent** that can search your library, read saved articles, and browse the web to dig into whatever you're reading.

## Why

Pocket shut down in July 2025. This is a local-first replacement: your data lives in a single SQLite file on your Mac, never leaves, and the app keeps working even without an internet connection or LLM API key.

## Features

**Reader**
- Save any URL → clean article extraction (trafilatura)
- Reader view: serif/sans, adjustable font size + width, light / dark / sepia
- Library with unread / favorites / archived / all tabs, sortable
- Manual + auto tags, keyword search (SQLite FTS5)
- Bookmarklet for one-click saving from any browser

**LLM (Cohere)**
- Auto-summary (1-line + TLDR) and auto-tags on save
- Semantic search across your library (Embed v3)
- Chat with any article (streaming)
- "Similar articles" via embedding cosine with similarity threshold

**Research Companion agent**
- Tool-using loop on Command A: `search_library`, `read_article`, `search_web`
- Streams agent trace: plan → tool calls → results → synthesized answer
- Inline `[1]`, `[2]` citations that link to a Sources list
- Optional web search via Tavily (free tier)

**Ops**
- Single URL (`http://localhost:8765`) — backend serves built frontend
- `launchd` plist for always-on (auto-start on login, auto-restart on crash)
- Zero third-party runtime dependencies besides Cohere + optional Tavily

## Stack

- **Backend**: FastAPI + SQLite (+ FTS5) + trafilatura + Cohere Python SDK
- **Frontend**: Vite + React + TypeScript + Tailwind
- **Data**: `~/ReaderData/reader.db` (single file, easy to back up)

## Setup

```bash
git clone https://github.com/dlwhyte/reed.git
cd reed

# 1. API keys
cp .env.example .env
# edit .env:
#   COHERE_API_KEY=...    (required for LLM features; dashboard.cohere.com)
#   TAVILY_API_KEY=...    (optional; tavily.com free tier enables web search)

# 2. Build the frontend (produces frontend/dist/ which the backend serves)
cd frontend
npm install
npm run build
cd ..

# 3. First run — creates venv, installs deps, starts server
./backend/run.sh
```

Open **http://localhost:8765**.

## Always-on (launchd)

Run the backend automatically on Mac login, restart on crash, never think about it again:

```bash
./scripts/install-launchd.sh
```

Backend now answers at `http://localhost:8765` whenever your Mac is on. Logs: `./logs/reader.{out,err}.log`.

Stop / uninstall: `./scripts/uninstall-launchd.sh`.

## Bookmarklet

Go to **Settings → Bookmarklet** and drag the button to your browser's bookmarks bar. Click it on any article to save directly to reed.

Works cross-origin from HTTPS pages (opens a tiny popup to the local backend, closes itself after saving).

## Project layout

```
reed/
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
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/             # Library, Reader, Settings
│       ├── components/        # SaveBar, ArticleCard, ChatPanel,
│       │                      # ResearchPanel (with citation parser)
│       ├── lib/api.ts         # fetch wrappers + SSE streams
│       └── store.ts
├── scripts/
│   ├── com.user.reader.plist
│   ├── install-launchd.sh
│   └── uninstall-launchd.sh
├── .env.example
└── .gitignore
```

## Disable LLM features

Set `ENABLE_LLM=false` in `.env` or leave `COHERE_API_KEY` empty. Reader keeps working — only summaries, auto-tags, chat, semantic search, and research agent are skipped.

## License

MIT — see [LICENSE](LICENSE).
