// Smoke tests for @browsefellow/mcp. Runs against compiled dist/ using
// Node's built-in test runner — no vitest/jest dep. Mocks global fetch
// so no network is hit.

import { test } from "node:test";
import assert from "node:assert/strict";

import { BrowseFellowClient } from "../dist/api.js";
import { buildTools } from "../dist/tools.js";

const VALID_TOKEN = "bft_test_abc123";
const BASE = "https://browsefellow.test";

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => handler(new URL(url), init);
  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("BrowseFellowClient rejects tokens without bft_ prefix", () => {
  assert.throws(() => new BrowseFellowClient(BASE, "no-prefix"), /bft_/);
  assert.throws(() => new BrowseFellowClient(BASE, ""), /bft_/);
  assert.doesNotThrow(() => new BrowseFellowClient(BASE, VALID_TOKEN));
});

test("searchLibrary hits /api/agent/search with Bearer auth and query params", async () => {
  let captured;
  const restore = mockFetch((url, init) => {
    captured = { url, init };
    return jsonResponse({ query: "iran", count: 0, results: [] });
  });
  try {
    const client = new BrowseFellowClient(BASE, VALID_TOKEN);
    const result = await client.searchLibrary("iran", 5);
    assert.equal(captured.url.pathname, "/api/agent/search");
    assert.equal(captured.url.searchParams.get("q"), "iran");
    assert.equal(captured.url.searchParams.get("limit"), "5");
    assert.equal(captured.init.headers.Authorization, `Bearer ${VALID_TOKEN}`);
    assert.equal(result.count, 0);
  } finally {
    restore();
  }
});

test("API errors surface as thrown errors with status code", async () => {
  const restore = mockFetch(() => new Response("unauthorized", { status: 401 }));
  try {
    const client = new BrowseFellowClient(BASE, VALID_TOKEN);
    await assert.rejects(() => client.searchLibrary("x"), /401/);
  } finally {
    restore();
  }
});

test("buildTools registers the three documented tools", () => {
  const client = new BrowseFellowClient(BASE, VALID_TOKEN);
  const tools = buildTools(client);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["get_article", "search_highlights", "search_library"]);
  for (const tool of tools) {
    assert.ok(tool.description.length > 20, `${tool.name} has a description`);
    assert.ok(typeof tool.handler === "function");
    assert.ok(tool.inputSchema && typeof tool.inputSchema === "object");
  }
});

test("search_library handler formats zero-result and multi-result cases", async () => {
  const client = new BrowseFellowClient(BASE, VALID_TOKEN);
  const [searchTool] = buildTools(client).filter((t) => t.name === "search_library");

  const emptyRestore = mockFetch(() => jsonResponse({ query: "x", count: 0, results: [] }));
  try {
    const out = await searchTool.handler({ query: "x" });
    assert.equal(out[0].type, "text");
    assert.match(out[0].text, /No saved articles match "x"/);
  } finally {
    emptyRestore();
  }

  const hitRestore = mockFetch(() =>
    jsonResponse({
      query: "drake",
      count: 1,
      results: [
        {
          id: 4,
          title: "Toronto fire crews dismantle Drake ice sculpture",
          url: "https://example.com/drake",
          site_name: "citynews",
          excerpt: "",
          summary: "A summary of the piece.",
          tags: ["toronto", "drake"],
          created_at: "2026-04-22T00:00:00Z",
          similarity: 0.1,
          highlights: [{ text: "public safety concerns", note: null }],
        },
      ],
    }),
  );
  try {
    const out = await searchTool.handler({ query: "drake", limit: 3 });
    const text = out[0].text;
    assert.match(text, /\[1\] Toronto fire crews/);
    assert.match(text, /similarity: 0\.10/);
    assert.match(text, /Tags: toronto, drake/);
    assert.match(text, /Summary: A summary of the piece\./);
    assert.match(text, /public safety concerns/);
    assert.match(text, /\(1 result for "drake"\)/);
  } finally {
    hitRestore();
  }
});
