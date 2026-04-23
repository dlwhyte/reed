#!/usr/bin/env node
// Entry point for `npx @browsefellow/mcp`. Spins up an MCP server on
// stdio that MCP-aware clients (Claude Code, Claude.ai, Cursor,
// ChatGPT desktop) can launch as a subprocess.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { BrowseFellowClient } from "./api.js";
import { buildTools } from "./tools.js";

const DEFAULT_URL = "https://browsefellow.com";

function requireEnv(): { url: string; token: string } {
  const token = process.env.BROWSEFELLOW_TOKEN || "";
  const url = process.env.BROWSEFELLOW_URL || DEFAULT_URL;
  if (!token) {
    console.error(
      "error: BROWSEFELLOW_TOKEN is not set.\n" +
        "  Generate a token at https://browsefellow.com/settings → AI tools\n" +
        "  Then add BROWSEFELLOW_TOKEN to the env in your MCP client's config.",
    );
    process.exit(1);
  }
  return { url, token };
}

function schemaToJson(shape: Record<string, z.ZodTypeAny>): Record<string, unknown> {
  // Minimal Zod → JSON schema conversion covering what our tools use
  // (string, number, optional, min/max, describe). Avoids a runtime dep
  // on zod-to-json-schema.
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, zodType] of Object.entries(shape)) {
    const isOptional = zodType.isOptional();
    const inner = isOptional ? (zodType as any)._def.innerType : zodType;
    const desc = (zodType as any)._def.description;
    let prop: Record<string, unknown>;
    if (inner._def.typeName === "ZodString") {
      prop = { type: "string" };
    } else if (inner._def.typeName === "ZodNumber") {
      prop = { type: "integer" };
      for (const check of inner._def.checks || []) {
        if (check.kind === "min") prop.minimum = check.value;
        if (check.kind === "max") prop.maximum = check.value;
      }
    } else {
      prop = {};
    }
    if (desc) prop.description = desc;
    properties[key] = prop;
    if (!isOptional) required.push(key);
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

async function main() {
  const { url, token } = requireEnv();
  const client = new BrowseFellowClient(url, token);
  const tools = buildTools(client);

  const server = new Server(
    { name: "browsefellow", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: schemaToJson(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${req.params.name}`);
    }
    const shape = z.object(tool.inputSchema);
    const args = shape.parse(req.params.arguments ?? {});
    try {
      const content = await tool.handler(args as Record<string, unknown>);
      return { content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `BrowseFellow error: ${message}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive; stdio transport handles the I/O loop.
}

main().catch((err) => {
  console.error("browsefellow-mcp failed to start:", err);
  process.exit(1);
});
