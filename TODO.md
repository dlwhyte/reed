# Follow-ups

Running list of known work that's been deferred with context.

## Security / deps

### Bump Capacitor v6 → v8
- **Why**: `@capacitor/cli` v6 pulls a vulnerable `tar` transitively (2 high-severity CVEs). Surfaced by `npm audit`. CI gate is currently set to `critical` to skip this so the pipeline stays green.
- **Risk profile**: build-time only — tar runs during `cap sync` / `cap add`, not at iOS runtime. Low real-world attack surface for a personal project.
- **Scope**: crosses two major versions (6 → 7 → 8). Expect iOS minimum-version bumps, plugin API changes, Node.js version floor moving.
- **How to do it safely**: branch, `npm install @capacitor/cli@8 @capacitor/core@8 @capacitor/ios@8`, `npx cap sync ios`, rebuild via Xcode, smoke test the iOS app (save + open + highlight), then flip CI `--audit-level=critical` → `--audit-level=high`.
- **When**: next time I'm actively touching the iOS build.

### Move `@capacitor/cli` to `devDependencies`
- It's a build tool, not runtime. Currently in `dependencies`, which is why `npm audit --omit=dev` still flags it. 1-line fix, safe.

### FastAPI `on_event` → lifespan
- Deprecation warnings in test output. Not breaking yet but will be in a future FastAPI major. Swap `@app.on_event("startup")` for the `lifespan` async context manager pattern.

## Product / features

### Real HTTPS on `browsefellow.com`
- Currently `http://browsefellow.com:8765` works (A record → Tailscale IP → backend). No TLS on the custom domain.
- Tailscale's built-in HTTPS works on `*.ts.net` only. For HTTPS on the custom domain behind Tailscale, run **Caddy** on the Mac, listen on `100.111.63.128:443`, use Let's Encrypt DNS-01 challenge (no public port needed), proxy to `localhost:8765`.
- Gets us `https://browsefellow.com` with a valid cert, accessible to any tailnet client.

### Auth layer (only if going public)
- The backend trusts any request that reaches it. Fine behind Tailscale. **Not fine** on a public VPS or Cloudflare Tunnel.
- Simplest: single shared token in an HTTP header, validated via FastAPI dependency. Token set in `.env`, sent from frontend/extension via configurable setting.
- Only do this when / if hosting moves beyond Tailscale.

### Configurable backend URL in the Chrome extension (option 3)
- `scripts/build-friend-extension.sh` currently bakes the URL in per build. If a friend wants to switch between their own backend and mine, they need a new zip.
- Real fix: `options.html` + `options.js` with one input, `optional_host_permissions: ["<all_urls>"]` in the manifest, runtime permission grant when URL is saved. ~1 hour.
- Do this if a friend actually asks, or before listing on the Chrome Web Store.

## Ops / hosting

### Pi or VPS migration
- Mac-hosted is working for now. Revisit when: uptime becomes a problem, I want to open it publicly (beyond tailnet), or I want the Mac for something else.
- Candidates: Raspberry Pi 4 (8GB) or Hetzner CX22 (~$5/mo).
- Would also pull in the HTTPS + auth items above.
