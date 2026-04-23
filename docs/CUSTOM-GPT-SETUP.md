# Creating the BrowseFellow Custom GPT

Steps to create a public "BrowseFellow" Custom GPT on the OpenAI GPT Store that lets ChatGPT Plus users pull from their BrowseFellow library.

Takes ~15 minutes once you have the things below.

## Prerequisites

- **ChatGPT Plus subscription** (required to create + publish Custom GPTs).
- **OpenAI account verified as a "builder"** (free; prompts in the GPT builder).
- **The OpenAPI spec** at `docs/openapi-agent.yaml` (already in this repo).

## Steps

1. Open https://chat.openai.com/gpts/editor.
2. Click **Create** → switch to the **Configure** tab.
3. Fill in:
   - **Name**: `BrowseFellow`
   - **Description**: `Search and pull from your BrowseFellow reading library. Ask what you've read about a topic, request a summary of a specific article, or search your highlights.`
   - **Instructions**: paste from `docs/CUSTOM-GPT-INSTRUCTIONS.md` (next file).
   - **Conversation starters** (suggestions):
     - `What have I been reading about AI?`
     - `Summarize article 42 from my library`
     - `Find highlights I made about attention spans`
   - **Knowledge**: leave empty — the GPT gets its context from Actions, not from uploaded files.
   - **Capabilities**: disable Web Browsing and DALL·E — they aren't needed and make responses slower. Leave Code Interpreter off too.
4. Scroll to **Actions** → **Create new action**.
5. In **Authentication**: select **API Key**, Auth Type **Bearer**. Leave the key blank for now (each user will paste their own).
6. In **Schema**: paste the full contents of `docs/openapi-agent.yaml`.
7. **Privacy policy**: `https://browsefellow.com/privacy`
8. In **Additional Settings**, check **"Instructions allow users to view raw action responses"** if you want debuggability during testing (turn off for public release).

## Testing

- Switch to the **Preview** pane on the right.
- Send a test message: `Find articles about X` (replace X with something you've saved).
- ChatGPT will prompt you for the API key — paste your `bft_...` token from BrowseFellow → Settings → AI tools.
- Confirm you get a result that includes titles + URLs + highlights from your library.

## Publish

1. In the GPT builder's top-right corner: **Save** → choose visibility:
   - **Private** (only you) — good for personal use first
   - **Anyone with the link** — good for sharing with friends
   - **Public** — listed in the GPT Store, discoverable
2. When publishing publicly:
   - Category: **Productivity**
   - Tags: `reader`, `reading`, `highlights`, `memory`, `research`
   - Ensure the privacy policy URL is filled

## Post-publish

- The GPT appears in your **Explore GPTs** list and (if public) eventually in the GPT Store.
- Each user who starts a conversation will be asked for their own BrowseFellow API token the first time — that's the API Key prompt in the Actions auth flow.
- Update the GPT by editing the Actions schema or instructions — changes go live on next save.
