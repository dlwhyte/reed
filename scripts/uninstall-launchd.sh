#!/bin/bash
PLIST_DST="$HOME/Library/LaunchAgents/com.user.reader.plist"
launchctl unload "$PLIST_DST" 2>/dev/null || true
rm -f "$PLIST_DST"
echo "✓ Reader launchd service uninstalled."
