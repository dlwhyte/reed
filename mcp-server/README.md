# `@browsefellow/mcp`

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets AI tools (Claude Code, Claude.ai, Cursor, ChatGPT desktop, and any other MCP-aware client) pull from your [BrowseFellow](https://browsefellow.com) reading library.

## What it does

When connected, the AI tool gains three read-only tools:

- **`search_library`** — semantic + keyword search over your saved articles. Returns results with your highlights inline.
- **`get_article`** — full readable text (up to 8 KB) of a specific article plus all its highlights.
- **`search_highlights`** — search or recent-list your highlighted passages directly.

So: ask Claude "what have I been reading about attention spans?" and it actually answers from *your* library, not generic web knowledge.

## Setup

1. Go to https://browsefellow.com → Settings → **AI tools** → create a token.
2. Copy the raw `bft_...` token (shown only once).
3. Add to your MCP client's config. Examples:

### Claude Code (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "browsefellow": {
      "command": "npx",
      "args": ["-y", "@browsefellow/mcp"],
      "env": {
        "BROWSEFELLOW_TOKEN": "bft_your_token_here"
      }
    }
  }
}
```

### Cursor (Settings → MCP → Add new MCP server)

Same config as Claude Code.

### Claude.ai (web) & ChatGPT desktop

These support MCP via "Connectors". In each tool's connectors/MCP settings, point to the hosted endpoint at `https://browsefellow.com/api/agent` with your token as the bearer. (The npm package isn't needed for remote-MCP clients.)

### Self-hosted BrowseFellow

If you're running BrowseFellow somewhere other than browsefellow.com, add `BROWSEFELLOW_URL` to the env:

```json
"env": {
  "BROWSEFELLOW_TOKEN": "bft_...",
  "BROWSEFELLOW_URL": "https://your.host"
}
```

## Privacy

- The server runs locally as a subprocess of your MCP client. It connects over HTTPS to your BrowseFellow backend with your token.
- It never reads anything outside the three endpoints above (search, get_article, highlights). It cannot modify your library.
- You can revoke the token from Settings → AI tools at any time. The server will start returning 401s immediately; no need to restart anything.

## License

MIT
