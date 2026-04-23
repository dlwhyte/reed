# Publishing `@browsefellow/mcp` to npm

One-time setup + the single command you run each time you cut a release.

## One-time: npm account + scope

1. Sign up at https://www.npmjs.com/ if you don't have an account.
2. Verify your email.
3. Claim the `@browsefellow` scope:
   - Go to your npm profile → **Organizations** → **Create organization**
   - Name: `browsefellow` — **Free plan** (unlimited public packages)
   - Accept the terms
4. Install npm CLI locally if not already: `npm --version` should work.
5. Log in: `npm login` (opens browser for verification).

## Pre-publish check

From the repo root:

```bash
cd mcp-server
npm run build
npm pack --dry-run   # see what files will actually ship
```

The dry run should show roughly:
- `dist/*.js` and `dist/*.d.ts`
- `README.md`
- `package.json`

Should NOT include `src/`, `node_modules/`, `tsconfig.json`, or stray dotfiles.

## Publish (first time)

```bash
cd mcp-server
npm publish --access public
```

`--access public` is required because it's a scoped package (`@browsefellow/*`) — npm defaults those to private otherwise.

Verify at https://www.npmjs.com/package/@browsefellow/mcp.

## Publish updates

For each release:

1. Bump the version in `mcp-server/package.json` (`0.1.0` → `0.1.1` for patches, `0.2.0` for new tools, `1.0.0` when stable).
2. `npm run build`
3. `npm publish`

Semver rule of thumb here:
- **Patch** (0.1.0 → 0.1.1): bug fix, no behavior change
- **Minor** (0.1.0 → 0.2.0): new tool added, new optional arg, compatible changes
- **Major** (0.x → 1.0): API change that existing configs need to adapt to

## Gotchas

- Once a version is published, it's immutable. You can't edit files at a version — you have to publish a new one. Think before shipping.
- Deprecated or bad versions can be marked with `npm deprecate @browsefellow/mcp@0.1.0 "message"` which shows a warning to anyone installing that version.
- If you need to pull a version entirely: `npm unpublish` only works within 72 hours of publishing. After that, deprecate + publish a replacement.
