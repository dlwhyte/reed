# Follow-ups

Running list of known work that's been deferred with context.

## Security / deps

### Move `@capacitor/cli` to `devDependencies`
- It's a build tool, not runtime. Currently in `dependencies`, which is why `npm audit --omit=dev` still flags it. 1-line fix, safe.

### FastAPI `on_event` → lifespan
- Deprecation warnings in test output. Not breaking yet but will be in a future FastAPI major. Swap `@app.on_event("startup")` for the `lifespan` async context manager pattern.

### Capacitor v6 → v8 (optional, no longer urgent)
- **Why it used to be here**: `@capacitor/cli` v6 pulls a vulnerable `tar` transitively. That critical CVE is now fixed (2026-08-08) via `"overrides": {"tar": "^7.5.21"}` in `frontend/package.json` — no major version bump needed.
- **Still true if ever revisited**: a real v6→v8 bump crosses two majors, needs Node ≥22 (CI currently on Node 20), and would touch the iOS build (minimum-version bumps, plugin API changes).
- **When**: only if some other reason to touch Capacitor comes up. Not driven by security anymore.

## Product / features

### Configurable backend URL in the Chrome extension (option 3)
- `scripts/build-friend-extension.sh` currently bakes the URL in per build. If a friend wants to switch between their own backend and mine, they need a new zip.
- Real fix: `options.html` + `options.js` with one input, `optional_host_permissions: ["<all_urls>"]` in the manifest, runtime permission grant when URL is saved. ~1 hour.
- Do this if a friend actually asks, or before listing on the Chrome Web Store.

## Ops / hosting

### DB backup retention / offsite copy
- Nightly local backup shipped 2026-08-08: `browsefellow-backup.timer` runs `sqlite3 .backup` at 03:30 UTC, writes to `/srv/browsefellow/backups/`, keeps the last 14 days.
- Protects against corruption / accidental deletion. Does **not** protect against total server/disk loss — everything's on the same box.
- If that risk matters more later (DB grows past trivial size, or this stops being a toy): add an offsite leg — rsync down to the Mac, or rclone to Hetzner Object Storage (needs a bucket + access keys first).

## Done (kept for history)

- **Pi or VPS migration** — live on Hetzner CPX11 (`5.161.238.66`) since 2026-07-15.
- **Real HTTPS on `browsefellow.com`** — nginx + certbot on the Hetzner box, verified serving valid TLS. (The old plan here was Mac+Tailscale+Caddy; superseded by the VPS move.)
- **Auth layer** — Clerk multi-user auth shipped (branch `auth/multi-user`, merged).
