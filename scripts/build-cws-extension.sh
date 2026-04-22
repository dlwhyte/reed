#!/bin/bash
# Build a Chrome Web Store-ready extension zip for the official
# BrowseFellow listing at https://browsefellow.com.
#
# Differs from build-friend-extension.sh in three ways:
#   - Hardcodes https://browsefellow.com (no Backend URL field in Options)
#   - Bumps manifest.version to a release number
#   - Adds CWS metadata (homepage_url, author) that reviewers expect
#
# Usage:
#   scripts/build-cws-extension.sh [version]
#     version — defaults to whatever's in manifest.json, or pass e.g. 1.0.1
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$REPO_ROOT/extension"
OUT_DIR="$REPO_ROOT/dist/extensions"
PROD_URL="https://browsefellow.com"

# Read version from arg, else bump from manifest.
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(python3 -c "import json; print(json.load(open('$SRC/manifest.json'))['version'])")
fi

STAGE="$OUT_DIR/browsefellow-cws-$VERSION"
ZIP="$OUT_DIR/browsefellow-cws-$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -rf "$STAGE" "$ZIP"
cp -R "$SRC" "$STAGE"

python3 - "$STAGE" "$PROD_URL" "$VERSION" <<'PY'
import json, sys, pathlib, re
stage, url, version = sys.argv[1], sys.argv[2], sys.argv[3]
root = pathlib.Path(stage)
host_match = f"{url}/*"

# --- manifest.json: host_permissions, version, metadata -------------------
mf = root / "manifest.json"
data = json.loads(mf.read_text())
data["version"] = version
data["host_permissions"] = [host_match]
data["homepage_url"] = url
# CWS lists author in the store; the manifest author is optional but nice.
data.setdefault("author", "BrowseFellow")
# MV3 extensions are expected to declare every permission they use. `storage`,
# `contextMenus`, `activeTab` are already there; drop any stale dev-only ones.
data["permissions"] = sorted(set(data.get("permissions", [])))
mf.write_text(json.dumps(data, indent=2) + "\n")

# --- Hardcode prod URL + strip the "Backend URL" Option -------------------
options_html = root / "options.html"
if options_html.exists():
    text = options_html.read_text()
    # Remove the Backend URL label + its <input>.
    text = re.sub(
        r'\s*<label for="backend">.*?</label>\s*<input id="backend"[^>]*>\s*',
        "\n",
        text,
        flags=re.DOTALL,
    )
    options_html.write_text(text)

options_js = root / "options.js"
if options_js.exists():
    text = options_js.read_text()
    # Rip out the backendInput read/write + collapse to a fixed URL.
    text = text.replace(
        'const DEFAULT_BACKEND = "http://localhost:8765";',
        f'const BACKEND = "{url}";',
    )
    text = re.sub(r"const backendInput = document\.getElementById\(\"backend\"\);\n", "", text)
    # (async function load() { ... }) block — rewrite to only read apiToken.
    text = re.sub(
        r"\(async function load\(\) \{.*?\}\)\(\);",
        """(async function load() {
  const { apiToken } = await chrome.storage.local.get(["apiToken"]);
  tokenInput.value = apiToken || "";
})();""",
        text,
        flags=re.DOTALL,
    )
    # saveBtn click handler: backend is a constant now, drop the read + save backendInput.value.
    text = re.sub(
        r"const backend = \(backendInput\.value \|\| DEFAULT_BACKEND\)\.replace\(/\\\/\+\$/, \"\"\);\s*",
        "const backend = BACKEND;\n  ",
        text,
    )
    text = text.replace(
        'await chrome.storage.local.set({ backend, apiToken });',
        'await chrome.storage.local.set({ backend, apiToken });',
    )
    options_js.write_text(text)

# --- Swap hardcoded localhost → prod URL everywhere -----------------------
for path in list(root.rglob("*.js")) + list(root.rglob("*.html")):
    text = path.read_text()
    new = text.replace("http://localhost:8765", url)
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

cd "$STAGE"
zip -qr "$ZIP" .
cd - >/dev/null

echo "✓ CWS-ready extension built"
echo "  Version: $VERSION"
echo "  Staged:  $STAGE"
echo "  Zip:     $ZIP"
echo ""
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole (pay \$5 one-time fee if you haven't)."
echo "  2. Click 'Add new item' → upload the zip."
echo "  3. Fill out the listing (see docs/CWS-LISTING.md)."
echo "  4. Submit for review (~1 day turnaround)."
