#!/bin/bash
# Install the Reader backend as a launchd service (runs on Mac login, always on)
set -e

PLIST_SRC="/Users/dlwhyte/Jarvis/reader/scripts/com.user.reader.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.user.reader.plist"

mkdir -p /Users/dlwhyte/Jarvis/reader/logs
cp "$PLIST_SRC" "$PLIST_DST"

launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo "✓ Reader backend installed as a launchd service."
echo "  Logs: /Users/dlwhyte/Jarvis/reader/logs/"
echo "  Stop: launchctl unload $PLIST_DST"
echo "  Start: launchctl load $PLIST_DST"
echo "  Backend will be at: http://localhost:8765"
