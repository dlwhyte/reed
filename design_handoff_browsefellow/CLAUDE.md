# BrowseFellow — Claude Code briefing

You are implementing the BrowseFellow design in a real codebase. This folder contains the design reference package.

## Start here

1. Read `README.md` end-to-end. It is the implementation spec.
2. Open `BrowseFellow.html` in a browser to see the live prototype. Every screen is reachable from the navigation chrome.
3. Open `Handoff.html` in a browser for the engineering-side companion (tokens, architecture, agent-loop details, open questions).
4. Read `components/tokens.jsx` to understand the design system before writing any component.

## What this package is

The HTML + JSX files are a **visual reference**, not production code. They use Babel-standalone in the browser for dev ergonomics. Port the visual design to the target codebase's patterns:

- Port inline-style objects → the codebase's styling solution (CSS Modules, Tailwind, vanilla-extract, etc.)
- Port the global `REED` tokens object → CSS custom properties + a TypeScript constants module
- Port hand-rolled icons → the codebase's icon library (Lucide, Phosphor, or similar) — match visual weight
- Port hand-rolled components → accessible primitives (Radix, Headless UI) composed with the target styling

## Target stack (assume unless told otherwise)

- React 18+ with TypeScript
- Vite
- Styling: ask the user before committing — Tailwind (token-driven) or CSS Modules (finer control) are both good fits
- State: React state + localStorage initially; swap to Zustand or Jotai if the shape grows
- Routing: TanStack Router or React Router v6

## Implementation order

Work in this order to minimize rework:

1. **Tokens** — `tokens.css` (custom properties) + `tokens.ts` (TS constants) from `components/tokens.jsx`. Include the paper-noise SVG as a base-layer utility.
2. **Primitives** — `<Icon>`, `<Wordmark>`, button variants, tab pills, tag chips. Get these right before anything else.
3. **Library** — simplest full screen. Good shakedown for the styling + state layer.
4. **Reader** — most complex UI. Article typography is the product — spend time here.
5. **Panels** — Chat + Research. Stub the agent with mock tool-call responses first.
6. **Save flow** — URL pill on desktop, extension popup.
7. **Secondary screens** — Settings, Tags, Search, Highlights, Empty/Offline states.
8. **Mobile** — Capacitor wrapper + mobile-specific layouts from `components/mobile.jsx`.
9. **Agent runtime** — real tool calls + streaming. Details in `Handoff.html §06`.

## Important design constraints (from the team)

- **Paper first.** The reader is the product. Everything else defers to it in contrast and density.
- **Local first.** The shelf lives on disk. The agent asks permission before making network calls.
- **Cite everything.** The Research agent never asserts without a source. Citations are inline, clickable, trace back to the tool call that produced them.
- **Few moods.** Three reader themes (light/sepia/dark) and four accents. No theme shop. Don't add variants.

## Open questions to raise

Before implementing these, ask the user for direction — they're marked open in `Handoff.html §09`:

- Sync protocol across devices (conflict model)
- Default agent model + whether users must bring their own API key
- Highlight export format (Markdown, JSON, both?)
- iOS-specific interactions (haptics, share sheet)

## Don't

- Don't ship the Babel-standalone setup to production
- Don't add animation or theme features the prototype doesn't show — the minimalism is intentional
- Don't replace the warm cream + terracotta palette with something "safer" — it's the identity
- Don't skip the paper-noise texture — it's small but it's the difference between "digital paper" and "generic beige"
- Don't copy the internal `REED.*` or `reed.route` / `reedBlink` / `reedDot` names verbatim — rename to the new product name during port

## When in doubt

Ask. The user that hired you is the designer who made this package. They'll have answers.
