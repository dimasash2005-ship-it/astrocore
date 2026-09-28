#!/usr/bin/env node
// AsCore MCP server — gives an OpenClaw agent 12 tools to read and write the
// owner's reports, memory and gallery in AsCore (list / create / update / delete).
// Installed by connect-mcp.sh into /opt/astrocore-mcp/server.js and registered
// with `openclaw mcp set astrocore`. Talks to AsCore's /api/agent/* routes with
// the owner's ac_live_ key (X-Api-Key), so it only ever sees that user's data.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.ASTROCORE_BASE_URL || "https://astrocore-eight.vercel.app").replace(/\/+$/, "")
const API_KEY = process.env.ASTROCORE_API_KEY

if (!API_KEY) {
  console.error("ASTROCORE_API_KEY env var is required. Exiting.")
  process.exit(1)
}

async function callAstroCore(resource, { method = "GET", query, body } = {}) {
  let url = `${BASE_URL}/api/agent/${resource}`
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, {
    method,
    headers: {
      "X-Api-Key": API_KEY,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let json
  try {
    json = await res.json()
  } catch {
    json = { error: `Non-JSON response (HTTP ${res.status})` }
  }

  return { status: res.status, json }
}

function toolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result.json, null, 2) }],
    isError: result.status >= 400,
  }
}

const server = new McpServer({ name: "astrocore", version: "1.0.0" })

const listInputShape = {
  id: z.string().uuid().optional().describe("If given, fetch this single item instead of listing."),
  limit: z.number().int().min(1).max(100).optional().describe("Max items to return (default 50)."),
  offset: z.number().int().min(0).optional().describe("Offset for pagination (default 0)."),
}

function registerResourceTools({ endpoint, singular, plural, createShape, updateShape }) {
  server.registerTool(
    `list_${plural}`,
    {
      title: `List ${plural}`,
      description: `List the user's ${plural} from AstroCore, or fetch one by id.`,
      inputSchema: listInputShape,
    },
    async ({ id, limit, offset }) => toolResult(await callAstroCore(endpoint, { query: { id, limit, offset } }))
  )

  server.registerTool(
    `create_${singular}`,
    {
      title: `Create ${singular}`,
      description: `Create a new ${singular} owned by the user in AstroCore.`,
      inputSchema: createShape,
    },
    async (input) => toolResult(await callAstroCore(endpoint, { method: "POST", body: input }))
  )

  server.registerTool(
    `update_${singular}`,
    {
      title: `Update ${singular}`,
      description: `Update one of the user's existing ${plural} in AstroCore by id.`,
      inputSchema: { id: z.string().uuid(), ...updateShape },
    },
    async (input) => toolResult(await callAstroCore(endpoint, { method: "PATCH", body: input }))
  )

  server.registerTool(
    `delete_${singular}`,
    {
      title: `Delete ${singular}`,
      description: `Delete one of the user's ${plural} in AstroCore by id.`,
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }) => toolResult(await callAstroCore(endpoint, { method: "DELETE", body: { id } }))
  )
}

registerResourceTools({
  endpoint: "reports",
  singular: "report",
  plural: "reports",
  createShape: {
    company_name: z.string().min(1).max(300),
    summary: z.string().min(1),
    chart_data: z.record(z.string(), z.unknown()).optional(),
  },
  updateShape: {
    company_name: z.string().min(1).max(300).optional(),
    summary: z.string().min(1).optional(),
    chart_data: z.record(z.string(), z.unknown()).optional(),
  },
})

registerResourceTools({
  endpoint: "memory",
  singular: "memory_item",
  plural: "memory_items",
  createShape: {
    title: z.string().min(1).max(300),
    content: z.string().min(1),
    source: z.string().min(1),
    tags: z.array(z.string()).optional(),
    agent_id: z.string().uuid().nullable().optional(),
  },
  updateShape: {
    title: z.string().min(1).max(300).optional(),
    content: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
    agent_id: z.string().uuid().nullable().optional(),
  },
})

registerResourceTools({
  endpoint: "gallery",
  singular: "gallery_item",
  plural: "gallery_items",
  createShape: {
    title: z.string().min(1).max(300),
    content: z.string().min(1),
    type: z.string().min(1),
    tags: z.array(z.string()).optional(),
    media_type: z.string().min(1),
    status: z.string().min(1),
    prompt: z.string().nullable().optional(),
    media_url: z.string().url().nullable().optional(),
    error_message: z.string().nullable().optional(),
    provider_id: z.string().uuid().nullable().optional(),
    generation_id: z.string().nullable().optional(),
  },
  updateShape: {
    title: z.string().min(1).max(300).optional(),
    content: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
    media_type: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    prompt: z.string().nullable().optional(),
    media_url: z.string().url().nullable().optional(),
    error_message: z.string().nullable().optional(),
    provider_id: z.string().uuid().nullable().optional(),
    generation_id: z.string().nullable().optional(),
  },
})

const transport = new StdioServerTransport()
await server.connect(transport)