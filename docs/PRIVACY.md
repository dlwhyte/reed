# BrowseFellow Privacy Policy

_Last updated: 2026-04-22_

BrowseFellow is a reading-shelf service at https://browsefellow.com and a companion Chrome extension that lets you save web pages to your shelf. This policy explains what data is collected, how it's used, and what your rights are.

## What we collect

**Account information** (stored in the BrowseFellow database, provided via Clerk):
- Your email address
- A unique user identifier issued by our authentication provider (Clerk)

**Content you save**:
- The URLs of pages you save
- Extracted readable text, titles, authors, publication dates, images, and excerpts of those pages
- Any highlights, notes, and tags you add
- Read state, progress, and timestamps

**Usage metadata** (when optional AI features are enabled):
- Aggregate token counts of calls made to the LLM provider (Cohere) on your behalf, used to track cost and enforce per-user limits.

**What we do NOT collect**:
- Web browsing history outside of pages you explicitly save
- Page content from sites you visit but don't save
- Any data about other tabs or windows
- Advertising identifiers
- Location data

## How we use your data

- To operate the service: display your saved articles, run keyword and semantic search, provide AI summaries if enabled, and render the reader UI.
- To enforce per-user limits on paid features.
- To debug and improve the service.

We do not sell or share your data with advertisers. We do not train models on your content.

## Third parties

- **Clerk** (authentication): handles sign-up, sign-in, and session management. Clerk receives your email and sign-in events. See https://clerk.com/privacy.
- **Cohere** (optional AI): if you use AI features, the title and text of the saved article are sent to Cohere for summarization, embedding, or chat. Cohere's policy: https://cohere.com/privacy.
- **Tavily** (optional web search): if you use the research agent with web search enabled, your query is sent to Tavily. Tavily's policy: https://tavily.com/privacy.
- **Hetzner** (hosting): BrowseFellow runs on a Hetzner Cloud VPS. Hetzner processes request metadata (IP, user-agent) for network operations only.
- **Let's Encrypt** (TLS): certificates for browsefellow.com are issued via Let's Encrypt.

## The Chrome extension

The extension talks only to https://browsefellow.com and only when you explicitly save a page via the popup, right-click menu, or keyboard shortcut. It reads the active tab's URL and title at the moment you invoke it. It does not track browsing, does not read page content unless you save the page, and does not send data to any other server. Your bookmarklet token is stored locally in `chrome.storage.local` and used only to authenticate to browsefellow.com.

## Data retention and deletion

Your data is retained as long as your account exists. To delete your account and all associated articles, highlights, and settings, email the address below; deletion is permanent and happens within 7 days.

## Your rights

- **Access** — you can see all your data through the BrowseFellow interface.
- **Export** — the Highlights page has an export feature; an API export for articles is available on request.
- **Deletion** — as above, email to delete.
- **Correction** — edit tags, highlights, and notes directly; update your email via Clerk.

## Contact

Questions or deletion requests: **dlwhyte@gmail.com**

## Changes

We'll update the "Last updated" date above when this policy changes. Material changes will be surfaced in the app.
