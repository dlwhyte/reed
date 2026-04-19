#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "Creating venv..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r requirements.txt
fi

PORT="${PORT:-8765}"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
