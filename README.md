# Reader

A personal read-it-later app. Pocket-style clean reader view, saved articles live on your Mac, AI summaries + auto-tags + chat-with-article powered by Cohere.

## Stack

- **Backend**: FastAPI + SQLite (+ FTS5 full-text search) + trafilatura (content extraction)
- **Frontend**: Vite + React + TypeScript + Tailwind
- **LLM**: Cohere (Command A for summaries/chat, Embed v3 for semantic search)
- **Data**: `~/ReaderData/reader.db` — all yours, back it up

## Setup

```bash
# 1. Copy env template and add your Cohere key
cp .env.example .env
# edit .env — paste COHERE_API_KEY

# 2. Backend (first run creates venv + installs deps)
./backend/run.sh
# → http://localhost:8765

# 3. Frontend (separate terminal)
cd frontend
npm run dev
# → http://localhost:5173
```

Visit **http://localhost:5173** to use the app.

## Always-on (launchd)

Run the backend automatically on Mac login, restart on crash:

```bash
./scripts/install-launchd.sh
```

Then bookmark `http://localhost:5173` (or serve the built frontend alongside).

To stop / uninstall:

```bash
./scripts/uninstall-launchd.sh
```

Logs: `./logs/reader.out.log`, `./logs/reader.err.log`

## Features

- Save any URL → extracts clean article text
- Reader view: serif/sans, adjustable font size + width, light/dark/sepia themes
- Library: unread / favorites / archived, sortable
- Tags: manual + auto (LLM)
- Keyword search (SQLite FTS5)
- Semantic search (Cohere embeddings)
- "Chat with article" — Q&A over the content
- Similar articles (embedding cosine)
- Bookmarklet for one-click saving from any browser

## Bookmarklet

Go to **Settings → Bookmarklet** and drag the button to your bookmarks bar. Click it on any page to save.

## Project layout

```
reader/
├── backend/
│   ├── app/               # FastAPI app
│   │   ├── main.py        # routes
│   │   ├── db.py          # SQLite schema + helpers
│   │   ├── extractor.py   # trafilatura-based content extraction
│   │   ├── cohere_client.py  # LLM calls
│   │   └── config.py
│   ├── requirements.txt
│   └── run.sh             # venv + uvicorn
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/         # Library, Reader, Settings
│       ├── components/    # SaveBar, ArticleCard, ChatPanel
│       ├── lib/api.ts     # fetch wrappers + SSE stream
│       └── store.ts       # user prefs
├── scripts/
│   ├── com.user.reader.plist
│   ├── install-launchd.sh
│   └── uninstall-launchd.sh
├── .env.example
└── .gitignore
```

## Disabling LLM features

Set `ENABLE_LLM=false` in `.env`, or remove the key. The app still works as a pure reader — summaries, chat, and semantic search will be disabled.

## What's not in v1

RSS, email-to-save, Chrome extension, iOS share sheet, highlights UI, reading stats — all candidates for Phase 2.
