// MCP tool definitions. Each tool is a pure wrapper around one
// BrowseFellow API call, plus formatting to make the result readable in
// an AI assistant's context window.

import { z } from "zod";
import type { BrowseFellowClient, AgentArticle } from "./api.js";

type ToolContent = { type: "text"; text: string };

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<ToolContent[]>;
};

/**
 * Format an article result for inline reading in an LLM context.
 * Compact: title, URL, short summary, inline highlights.
 */
function formatArticle(a: AgentArticle, index?: number): string {
  const header = index !== undefined ? `[${index + 1}] ` : "";
  const similarity =
    a.similarity !== undefined ? `  (similarity: ${a.similarity.toFixed(2)})` : "";
  const tags = a.tags.length ? `\n    Tags: ${a.tags.join(", ")}` : "";
  const summary = a.summary
    ? `\n    Summary: ${a.summary}`
    : a.excerpt
      ? `\n    Excerpt: ${a.excerpt.slice(0, 240)}${a.excerpt.length > 240 ? "…" : ""}`
      : "";
  const highlights =
    a.highlights.length > 0
      ? `\n    Highlights (${a.highlights.length}):\n` +
        a.highlights
          .map(
            (h) =>
              `      - "${h.text}"${h.note ? ` — note: ${h.note}` : ""}`,
          )
          .join("\n")
      : "";
  return (
    `${header}${a.title}${similarity}\n` +
    `    URL: ${a.url}\n` +
    `    ID: ${a.id}${tags}${summary}${highlights}`
  );
}

export function buildTools(client: BrowseFellowClient): ToolDef[] {
  return [
    {
      name: "search_library",
      description:
        "Search the user's BrowseFellow reading library by topic or keyword. Returns saved articles ranked by relevance, with their highlights inline. Use this first when the user asks about something they might have read about, or when you need to ground an answer in their previous reading.",
      inputSchema: {
        query: z.string().min(1).describe("Natural-language search query"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe("Max results (default 10)"),
      },
      async handler(args) {
        const query = args.query as string;
        const limit = (args.limit as number | undefined) ?? 10;
        const r = await client.searchLibrary(query, limit);
        if (r.count === 0) {
          return [
            {
              type: "text",
              text: `No saved articles match "${query}".`,
            },
          ];
        }
        const body =
          r.results.map((a, i) => formatArticle(a, i)).join("\n\n") +
          `\n\n(${r.count} result${r.count === 1 ? "" : "s"} for "${query}")`;
        return [{ type: "text", text: body }];
      },
    },
    {
      name: "get_article",
      description:
        "Fetch the full text (up to 8000 chars) of a specific article from the user's library, along with all highlights they've made on it. Use this after search_library to read the top result more deeply, or when you have a specific article_id from a prior call.",
      inputSchema: {
        article_id: z.number().int().positive().describe("Article ID returned by search_library"),
      },
      async handler(args) {
        const article_id = args.article_id as number;
        const a = await client.getArticle(article_id);
        const parts: string[] = [
          `Title: ${a.title}`,
          `URL: ${a.url}`,
          a.author ? `Author: ${a.author}` : null,
          a.published ? `Published: ${a.published}` : null,
          a.site_name ? `Site: ${a.site_name}` : null,
          a.tags.length ? `Tags: ${a.tags.join(", ")}` : null,
          a.summary_long
            ? `Summary: ${a.summary_long}`
            : a.summary_short
              ? `Summary: ${a.summary_short}`
              : null,
          "",
          `Content${a.content_truncated ? " (truncated)" : ""}:`,
          a.content,
        ].filter((x): x is string => x !== null);
        if (a.highlights.length > 0) {
          parts.push(
            "",
            `Highlights (${a.highlights.length}):`,
            ...a.highlights.map(
              (h) => `  - "${h.text}"${h.note ? ` — note: ${h.note}` : ""}`,
            ),
          );
        }
        return [{ type: "text", text: parts.join("\n") }];
      },
    },
    {
      name: "search_highlights",
      description:
        "Search the user's highlighted passages. Highlights are often more useful than article text because they represent passages the user deliberately flagged. Leave `query` empty to get the most-recent highlights.",
      inputSchema: {
        query: z.string().optional().describe("Keyword to match in highlight text or note"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results (default 20)"),
      },
      async handler(args) {
        const query = args.query as string | undefined;
        const limit = (args.limit as number | undefined) ?? 20;
        const r = await client.searchHighlights(query, limit);
        if (r.count === 0) {
          return [
            {
              type: "text",
              text: query
                ? `No highlights match "${query}".`
                : "No highlights yet.",
            },
          ];
        }
        const body = r.results
          .map(
            (h, i) =>
              `[${i + 1}] "${h.text}"${
                h.note ? `\n    Note: ${h.note}` : ""
              }\n    From: ${h.article.title} — ${h.article.url}`,
          )
          .join("\n\n");
        return [
          {
            type: "text",
            text:
              body +
              `\n\n(${r.count} highlight${r.count === 1 ? "" : "s"}${
                query ? ` for "${query}"` : ""
              })`,
          },
        ];
      },
    },
  ];
}
