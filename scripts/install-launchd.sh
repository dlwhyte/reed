#!/bin/bash
# Install the Reader backend as a launchd service (runs on Mac login, always on)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REED_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.user.reader.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.user.reader.plist"

mkdir -p "$REED_ROOT/logs"
sed "s|__REED_ROOT__|$REED_ROOT|g" "$PLIST_SRC" > "$PLIST_DST"

launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo "✓ Reader backend installed as a launchd service."
echo "  Root: $REED_ROOT"
echo "  Logs: $REED_ROOT/logs/"
echo "  Stop: launchctl unload $PLIST_DST"
echo "  Start: launchctl load $PLIST_DST"
echo "  Backend will be at: http://localhost:8765"
