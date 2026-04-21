# Handoff: BrowseFellow

## Overview

BrowseFellow is a read-it-later app with an embedded Chat + Research agent. This handoff covers a full redesign of the product: a warmer, editorial, local-first rethinking oriented around the reader as the product.

Scope:

- **Desktop** (Library + Reader) — the primary surface
- **iOS** (Capacitor, same JS) — mobile Library + Reader
- **Chrome extension popup** — save flow from any page
- **Supporting surfaces** — Settings, Tags, Search, Highlights, Empty/Offline states
- **Agent loop visualization** — how the Research agent cites and traces

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** — prototypes showing intended look and behavior, not production code to copy directly.

The task is to **recreate these designs in the target codebase's existing environment** — likely React with your own build tooling, routing, data layer, and styling solution. If no app environment exists yet, choose the most appropriate framework and implement there.

The prototype uses:

- Babel-standalone in the browser (dev ergonomics only — not production)
- Global `REED` tokens object attached to `window` (port to CSS custom properties or a theme object)
- Inline-style objects everywhere (port to your CSS solution: CSS Modules, vanilla-extract, Tailwind, etc.)
- Hand-rolled icons (see `components/primitives.jsx` — swap for Lucide, Phosphor, or your own set)
- Hand-rolled components with no external UI library (swap for Radix/Headless UI primitives where appropriate for accessibility)

## Fidelity

**High-fidelity.** Colors, typography, spacing, and interactions are final. Reproduce the UI pixel-perfectly using the codebase's libraries and patterns.

Exceptions:

- Icons are illustrative, not final — use your icon library
- Sample article content is placeholder — real content comes from the parsing pipeline
- The "paper noise" SVG texture in `components/tokens.jsx` is baseline but tunable

## Screens / Views

### 1. Library (desktop)

**Route:** `/` (default)
**Purpose:** Browse saved articles. Primary entry point.
**File:** `components/library.jsx`

**Layout:**
- Sticky header (68px tall) with wordmark, kicker subtitle, icon buttons (search, settings), and save-URL pill
- Tabs row below header: `unread / favorites / archived / all` — pill-style, dashed bottom-border divider
- Search + semantic-search toggle row
- Tag chip rail (horizontal scroll)
- Article list — "Mixed" density (one lead + grid of cards), "Compact" (list), or "Grid" density toggle
- Lead article card: 2-column grid (1.1fr cover / 1.3fr text), 32px display serif title, italic summary, tag pills
- Secondary cards: smaller covers, 24px title, same tag system

**Components:**
- `<Wordmark>` — "BrowseFellow" in Source Serif 4 600 + 6px terracotta dot (see `primitives.jsx`)
- `<SaveUrlPill>` — inline URL input, terracotta save button when non-empty
- `<TabPill>` — rounded-full, black bg when active
- `<TagChip>` — mono font, hashtag prefix, count in opacity 0.5
- `<ArticleCard>` — full-width lead variant + compact-grid variant

### 2. Reader (desktop)

**Route:** `/article/:id`
**Purpose:** Read a saved piece. Chat + Research agents dock on the right.
**File:** `components/reader.jsx`

**Layout:**
- Two-column flex: article body (max 680px) + optional side panel (420px when open)
- Sticky toolbar at top with back arrow, "reading from <site>", action icons (star, chat, flask, theme, settings)
- Article body: kicker (site · author), 32–48px clamp display title, meta line (read time, age), TL;DR card, drop-cap first paragraph, body paragraphs, blockquotes with terracotta left rule, "From your shelf, nearby" related-articles section at bottom
- Themes: light (paper), sepia, dark — only the reader itself changes; chrome stays warm
- Fonts: serif (Source Serif 4) or sans (Inter) — user choice
- Size: 14–22px slider

**Side panels:**
- Chat: plum accent, message bubbles, composer at bottom
- Research: olive accent, agent trace (collapsible), citation chips inline in answers, composer at bottom

### 3. Mobile Library + Reader

**File:** `components/mobile.jsx`
**Purpose:** iOS (via Capacitor) parity with desktop essentials.

- Library: simpler single-column list, sticky header collapses on scroll
- Reader: same typographic treatment, full-width, swipe-back gesture
- Save sheet: "Save to BrowseFellow" CTA, tag chooser, optional note field
- Uses `ios-frame.jsx` for prototype framing only — not part of the implementation

### 4. Chrome Extension Popup

**File:** referenced in `components/flows.jsx` (`SaveFlow`)
**Size:** 340×380 popup
**Purpose:** One-click save from any browser tab

- Shows current tab title + favicon at top
- Single terracotta "Save" button, disabled state → saving spinner → saved confirmation
- Optional tag input (autocomplete against user's existing tags)
- Links to open the saved article in the desktop app

### 5. Settings

**File:** `components/settings.jsx`
**Tabs:** General, Reader, Agent, Shortcuts, About

- General: storage location picker, sync toggle, import/export
- Reader: default theme, default font, default size, line-width cap
- Agent: model picker, API key field (local only, never synced), tool allow-list
- Shortcuts: keyboard map (read-only list for now)
- About: version, build, credits

### 6. Tags + Search + Highlights

**Files:** `components/phase2.jsx` (`TagsView`, `SearchView`, `HighlightsView`, `HighlightReader`)

- **Tags:** index of all tags with counts, sorted by frequency. Click → filtered library view.
- **Search:** hybrid keyword + semantic. Results list shows article card + highlighted snippet. Toggle at top.
- **Highlights (all):** chronological list of every highlight across shelf. Each shows article metadata + excerpt.
- **Highlights (in reader):** sidebar of current article's highlights. Click to scroll to the in-text mark.

### 7. Supporting states

**File:** `components/phase2.jsx`

- **Empty shelf:** illustrated empty state with save-URL affordance
- **Offline reader:** article still reads, chat/research panels show "offline" pill
- **Error trace:** expandable agent trace when a tool call fails — shows which step errored, structured diff
- **Agent loop viz (`RealAgentLoop`):** demo of how the agent reasons — tool call → tool result → reflection → answer

## Interactions & Behavior

### Library

- Clicking an article card navigates to `/article/:id`
- Clicking a tag chip filters the list; clicking the active tag clears it
- Typing in search updates results debounced 150ms
- Semantic search toggle is stateful per-session (not persisted)
- Density toggle (Mixed/Compact/Grid) is persisted to localStorage

### Reader

- Star icon toggles favorite — instant, optimistic
- Chat icon opens chat panel (plum), flask icon opens research panel (olive) — mutually exclusive
- Theme icon cycles light → sepia → dark
- Font icon toggles serif ↔ sans
- Size keys `-`/`+` adjust font size
- Scroll position persisted per-article
- Back arrow returns to previous route (Library or Search)

### Chat panel

- Streaming tokens render a 1px blinking caret (`reedBlink` keyframe, 1s interval)
- Typing dots (`reedDot` keyframe) while waiting for first token
- Suggested prompts auto-hide after first message
- Every answer scoped to the current article — the agent is told "only answer from this article; cite paragraph numbers"

### Research panel

- Agent trace is collapsed by default ("Agent trace · N steps" header)
- Expand to see each step: tool call (mono), arguments, result, reflection
- Inline citations in the answer link to the trace step that produced them
- Errored steps highlighted in terracotta with retry affordance

### Save flow (URL pill + extension)

- Empty input → button disabled (rule-color background)
- Typing a valid URL → button terracotta
- Submit → optimistic insert into list, shows "→ saving to shelf" olive confirmation, article arrives from parse API ~500–1500ms later
- On parse failure: the optimistic insert gets a small terracotta error pill; user can retry or dismiss

### Animation tokens

- All transitions: 180ms ease-out
- Panel slide-in: 240ms cubic-bezier(0.32, 0.72, 0, 1)
- Theme change: no transition (avoid FOUC-like flicker)
- Agent trace expand: 200ms ease-out on max-height

## State Management

State needed (names, not specific to any library):

- `articles` — list of shelf items (id, url, title, author, site, tags, saved-at, read-state, favorite, full-text, highlights)
- `route` — `{ name: 'library' | 'reader' | 'settings' | ..., params: {...} }`, persisted to localStorage as `browsefellow.route` (currently `reed.route` in prototype — rename on port)
- `readerPrefs` — `{ theme, fontKind, size, accent }`, persisted
- `libraryPrefs` — `{ density, semantic }`, session-only
- `chat[articleId]` — message history scoped to article, persisted
- `research[articleId]` — last research query + trace, persisted
- `agentConfig` — model, API key (keychain/secure storage), tool allow-list

Data fetching:

- Parse service (content extraction) — POST URL → {title, content, meta}. Runs on save.
- Embedding service (for semantic search) — POST text → vector. Runs async after parse.
- Agent runtime (Chat + Research) — streaming response protocol, tool call protocol. Details in `Handoff.html` §06.

## Design Tokens

All tokens in `components/tokens.jsx` under the `REED` object. Rename to `BROWSEFELLOW` or `tokens` when porting.

### Paper + Ink
```
paper          #F8F1E4   cream background
paperDeep      #F2E8D3   section background, empty states
paperRaised    #FDF8EC   cards, raised surfaces
ink            #2B2320   primary text
inkMuted       #7A6B5F   secondary text
inkFaint       #B3A594   tertiary text, icon default
rule           #E3D6BE   borders, dividers
butter         #F2D5B8   TL;DR card tint, tag pill bg
```

### Accents (oklch — widely supported, easier to tune)
```
terracotta     oklch(0.65 0.12 40)    primary brand accent
terracottaSoft oklch(0.9 0.05 40)     muted tint
olive          oklch(0.55 0.08 130)   research / agent
oliveSoft      oklch(0.92 0.04 130)
plum           oklch(0.52 0.08 340)   chat
plumSoft       oklch(0.93 0.04 340)
```

### Reader palettes

- **Light**: the default paper/ink tokens above
- **Sepia** (`REED.sepia`): paper `#EBE1C9`, ink `#3D3228`
- **Dark** (`REED.dark`): paper `#20191A`, ink `#E8DEC9`, paperRaised `#2A2221`

### Type scale

- **Display** — Source Serif 4, weights 400/500/600/700. Used for: titles (16–48px clamp), drop-caps, TL;DR, wordmark, reading-body option.
- **Sans** — Inter, weights 400/500/600/700. Used for: all UI chrome, buttons, reading-body option.
- **Mono** — JetBrains Mono, weights 400/500. Used for: kickers (10–11px uppercase tracked), meta rows, tag pills, agent traces.

Specific sizes in `Handoff.html §03 Type`.

### Radii
```
sm  6px      // icon buttons, small controls
md  10px     // swatches
lg  14px     // cards, panels, composers
xl  18px     // lead article card, URL pill, primary card
pill 999px   // tab pills, chip pills, CTAs
```

### Elevation
- Cards: `0 1px 0 rgba(43,35,32,0.02), 0 30px 60px -40px rgba(43,35,32,0.3)` (warm, far shadow)
- URL pill: `0 1px 0 rgba(43,35,32,0.02), 0 8px 20px -12px rgba(43,35,32,0.1)`
- Tweaks panel / modals: `0 10px 40px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.06)`
- Reader article: no shadow — flat, paper-to-paper

### Paper noise
`PAPER_NOISE` is an inline SVG data-URI fractal-noise filter. Applied as `backgroundImage` at `240px` tile to main paper surfaces. Adds very subtle grain. Port as a utility class or base-layer CSS.

## Assets

- **Fonts** — all Google Fonts, swap for self-hosted in production:
  - Source Serif 4 (ital, opsz 8–60, wght 400/500/600/700)
  - Inter (wght 400/500/600/700)
  - JetBrains Mono (wght 400/500)
- **Icons** — hand-rolled SVG in `components/primitives.jsx` (`Icon` component). Names: `search`, `settings`, `star`, `chat`, `flask`, `sun`, `moon`, `coffee`, `x`, `plus2`, `plus`, `chevD`, `chevRs`, `lib`, `book`, `globe`, `sparkle`, `url`, `check`, `bookmark`, etc. Swap for Lucide or your icon library — match visual weight (1.8px stroke, slightly rounded).
- **Sample content** — in `components/data.jsx` (`SAMPLE_ARTICLES`, `SAMPLE_TAGS`). Placeholder only.

## Files

Top-level:

- `BrowseFellow.html` — full prototype, routes between views. Open in browser to explore.
- `Handoff.html` — companion engineering doc with tokens, architecture, agent-loop details, open questions.

Components (`components/`):

- `tokens.jsx` — `REED` object + `PAPER_NOISE` + `inkStamp` helper
- `data.jsx` — sample articles and tags
- `primitives.jsx` — `Icon`, `Wordmark`, `Cite`, `Tab`, `TypingDots`, `Cover` (article cover image)
- `panels.jsx` — `ChatPane`, `ResearchPane`, `Composer`, `SidePanel`, `AgentTrace`
- `library.jsx` — `Library` (full desktop library view)
- `reader.jsx` — `Reader` (full desktop article view, includes toolbar, body, related)
- `mobile.jsx` — `MobileLibrary`, `MobileReader`, mobile-specific components
- `settings.jsx` — `Settings` view with tabs
- `flows.jsx` — `SaveFlow` (extension popup)
- `phase2.jsx` — `TagsView`, `SearchView`, `HighlightsView`, `HighlightReader`, `EmptyShelf`, `OfflineReader`, `ErrorTrace`, `TraceVariations`, `RealAgentLoop`

Supporting:

- `ios-frame.jsx` — device bezel for prototype demo only, not to be ported
- `design-canvas.jsx` — design-system showcase view, demo only

## Open Questions

See `Handoff.html §09` for the live list. Summary of known-open items at time of handoff:

- Sync protocol — if shelves sync across devices, what's the conflict model?
- Agent model choice — default model + whether users must bring their own API key
- Highlight export format (Markdown? JSON? Both?)
- iOS-specific interactions (haptics, share sheet handling) — not fully specced in prototype

## Running the prototype locally

Just open `BrowseFellow.html` in a browser. Everything is Babel-standalone + inline JSX; no build step. Do **not** use this setup in production — it's slow and has no tree-shaking.

For an implementation starting point in a real React app:

1. Set up Vite + React + TypeScript
2. Install your preferred styling (Tailwind recommended for token-driven work, or CSS Modules for more control)
3. Port `tokens.jsx` → `tokens.css` (CSS custom properties) + `tokens.ts` (TS constants)
4. Build `<Wordmark>`, `<Icon>`, button primitives first — everything else composes from these
5. Build Library next (simplest screen), then Reader (most complex), then panels, then mobile
6. Agent runtime last — can be stubbed with mock tool calls until the real backend is ready
