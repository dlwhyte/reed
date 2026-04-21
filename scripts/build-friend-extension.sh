#!/bin/bash
# Build a Chrome extension .zip that points at an arbitrary BrowseFellow URL
# (e.g. your Tailscale hostname) instead of http://localhost:8765. Hand the
# zip to a friend — they unzip it, load unpacked in chrome://extensions, and
# it saves to your shelf without needing to configure anything.
#
# Usage: scripts/build-friend-extension.sh <backend-url>
#   scripts/build-friend-extension.sh https://browsefellow.com
#   scripts/build-friend-extension.sh http://ds-macbook-pro-2.tail3f024c.ts.net
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backend-url>"
  echo "Example: $0 https://browsefellow.com"
  exit 1
fi

URL="$1"
# Strip any trailing slash so we don't generate `https://x.com//api/save`.
URL="${URL%/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REED_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$REED_ROOT/extension"
OUT_DIR="$REED_ROOT/dist/extensions"
# Derive a safe slug from the URL for the output filename.
SLUG="$(echo "$URL" | sed -E 's|https?://||; s|[^A-Za-z0-9._-]|-|g')"
STAGE="$OUT_DIR/browsefellow-$SLUG"
ZIP="$OUT_DIR/browsefellow-$SLUG.zip"

mkdir -p "$OUT_DIR"
rm -rf "$STAGE" "$ZIP"
cp -R "$SRC" "$STAGE"

# Host permission must match the URL scheme + host. Chrome wants a trailing
# /* to grant access to every path under that origin.
HOST_MATCH="$URL/*"

# Replace the hardcoded localhost URL everywhere it appears in the extension.
# Also update the manifest's host_permissions entry.
python3 - "$STAGE" "$URL" "$HOST_MATCH" <<'PY'
import json, sys, pathlib, re
stage, url, host_match = sys.argv[1], sys.argv[2], sys.argv[3]
root = pathlib.Path(stage)

# Rewrite manifest.json
mf = root / "manifest.json"
data = json.loads(mf.read_text())
data["host_permissions"] = [host_match]
mf.write_text(json.dumps(data, indent=2) + "\n")

# Rewrite every JS/HTML file: swap hardcoded localhost:8765 for the new URL.
for path in list(root.rglob("*.js")) + list(root.rglob("*.html")):
    text = path.read_text()
    new = text.replace("http://localhost:8765", url)
    # Fix the "port 8765" copy that only makes sense for localhost.
    new = new.replace(
        "Is the backend running on port 8765?",
        f"Is {url} reachable?",
    )
    new = new.replace(
        "Start the backend on port 8765 and retry.",
        f"Make sure {url} is reachable and retry.",
    )
    if new != text:
        path.write_text(new)
PY

# Zip the staged directory so the contents sit at the archive root.
cd "$STAGE"
zip -qr "$ZIP" .
cd - >/dev/null

echo "✓ Built extension for $URL"
echo "  Staged: $STAGE"
echo "  Zip:    $ZIP"
echo ""
echo "Install instructions for a friend (paste into a DM along with the zip):"
echo ""
echo "  1. Unzip browsefellow-$SLUG.zip somewhere permanent."
echo "  2. Open chrome://extensions in Chrome."
echo "  3. Toggle 'Developer mode' on (top-right)."
echo "  4. Click 'Load unpacked' and pick the unzipped folder."
echo "  5. Pin the BrowseFellow icon to your toolbar."
