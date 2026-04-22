# Chrome Web Store Listing — BrowseFellow

Copy-paste material for the Chrome Web Store developer dashboard when submitting the extension. Swap in your own wording if anything feels off.

## Core fields

**Name**: `BrowseFellow`

**Summary** (≤132 chars, shows in search results):
> Save any page to BrowseFellow — a warm reading shelf with highlights, tags, and optional AI summaries.

**Category**: `Productivity`

**Language**: English

## Detailed description

Paste into the "Description" field (no strict length limit, but ~2000 chars is the sweet spot).

```
BrowseFellow is a reading shelf that actually feels warm to come back to.

Save any page — a long article, a docs page, a friend's blog post — with one
click. The extension grabs the URL, BrowseFellow extracts the readable
content, and you get a clean reader view, highlights, tags, and full-text
search. Your shelf is yours: only you can see your articles.

WHAT YOU CAN DO
• Save the current tab or a right-clicked link.
• Read saved pages in a distraction-free reader (serif, sepia, dusk themes).
• Highlight passages with notes — exportable as Markdown.
• Search by keyword, tag, or (with optional AI) meaning.
• Optional AI: summaries, chat with the article, research agent that can
  pull from your library and the open web.

HOW IT WORKS
You sign in to BrowseFellow (https://browsefellow.com), copy your
bookmarklet token from Settings, and paste it into this extension's Options
page. From then on, every click of the BrowseFellow button saves to your
account.

PRIVACY
The extension talks only to browsefellow.com and only when you click Save.
It does not track your browsing, read your tabs, or send data anywhere
else. Full policy: https://browsefellow.com/privacy

BrowseFellow is a personal project. Questions or feedback:
dlwhyte@gmail.com
```

## Privacy practices (required form)

Chrome Web Store asks you to declare what data the extension handles. For this extension:

- **Personally identifiable information**: No (the extension itself doesn't handle email/auth — the bookmarklet token is a random opaque string.)
- **Health information**: No
- **Financial and payment information**: No
- **Authentication information**: Yes (bookmarklet token — explain: "The extension stores a long-lived API token that the user generates on browsefellow.com so it can save pages on their behalf. Stored locally in chrome.storage.local.")
- **Personal communications**: No
- **Location**: No
- **Web history**: No (only pages the user explicitly saves)
- **User activity**: Yes (explain: "Only the URL and title of the tab at the moment the user clicks Save.")
- **Website content**: Yes (explain: "Only the URL of the page being saved; the server fetches and extracts the content itself.")

**Data usage declarations** (check as appropriate):
- [x] Data is **not** sold to third parties
- [x] Data is **not** used or transferred for purposes unrelated to the item's core functionality
- [x] Data is **not** used to determine creditworthiness or for lending purposes

**Privacy policy URL**: `https://browsefellow.com/privacy`

## Assets you need to prepare

- **Icon**: 128×128 PNG, already in the zip (`icons/icon128.png`).
- **Screenshots** (at least 1, up to 5): 1280×800 or 640×400. Good ones:
  1. The library view with a few saved articles
  2. The reader view with a highlight
  3. The extension popup over a real webpage
  4. The Settings page showing the bookmarklet-token copy UI
- **Small promo tile** (optional): 440×280. Skip if you don't have one.
- **Marquee promo tile** (optional, big): 1400×560. Skip.

## Submission steps

1. Go to https://chrome.google.com/webstore/devconsole.
2. Pay the one-time $5 developer registration fee if this is your first listing.
3. Click **Add new item** → upload `dist/extensions/browsefellow-cws-1.0.0.zip`.
4. Fill in the core fields, detailed description, and privacy practices above.
5. Upload screenshots.
6. Set distribution: **Public**. Regions: all.
7. Click **Submit for review**. Turnaround is usually 1–3 business days.

## After it's approved

- Share the CWS listing URL with friends.
- Update `docs/CWS-LISTING.md` with the listing URL.
- For every update: bump `manifest.json` version, rebuild with
  `scripts/build-cws-extension.sh 1.0.1`, upload the new zip to the same
  listing. Reviews on updates are usually faster.
