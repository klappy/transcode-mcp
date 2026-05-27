---
title: Oddkit MCP Client Configuration
date: 2026-05-27
status: stable
governs: how agents connect oddkit to this repo's knowledge base
complements:
  - canon/governance/writing-conventions.md
---

# Oddkit MCP Client Configuration

> Agents working on klappy/transcode-mcp should connect to the oddkit MCP server at `https://oddkit.klappy.dev/mcp` with `knowledge_base_url` set to `https://github.com/klappy/transcode-mcp`. With `knowledge_base_url` set, oddkit runs in strict mode — missing canon files fall through to the bundled governance tier rather than silently substituting from the parent canon at klappy.dev. This file is documentation; it is read by humans, not consumed as machine-readable config.

---

## Summary — Wire Agents to the Repo's Own Canon, Not the Parent's

When an agent calls `oddkit_search`, `oddkit_get`, `oddkit_preflight`, or any other oddkit action with no `knowledge_base_url`, oddkit reads from the default parent canon at `klappy.dev`. For work on this repo, that means the agent gets the parent canon's writing conventions, its definition of done, and its constraints — not transcode-mcp's. The fix is to pass `knowledge_base_url: "https://github.com/klappy/transcode-mcp"` on every oddkit call (or to configure the MCP client so the URL is set automatically). Strict mode protects against silent fallthrough: if a doc is missing from this repo's canon, the response declares `governance_source: bundled` instead of stitching in the parent's version.

---

## Claude Desktop / Claude.ai

In the project's MCP settings, add the oddkit connector at `https://oddkit.klappy.dev/mcp`. There is no `knowledge_base_url` field in the client config; the agent must pass it on every tool call. The project's `AGENTS.md` is where that instruction lives for AI callers.

## Cursor / IDEs with `mcpServers` config

```jsonc
{
  "mcpServers": {
    "oddkit": {
      "url": "https://oddkit.klappy.dev/mcp"
    }
  }
}
```

Same caveat: `knowledge_base_url` is a per-call argument, not a connector-level setting.

## Calling from agent code

When the agent calls `oddkit` actions directly (as `src/worker.ts` does in the `docs` tool), pass `knowledge_base_url` explicitly:

```typescript
await client.callTool({
  name: "oddkit",
  arguments: {
    action: "search",
    input: query,
    knowledge_base_url: "https://github.com/klappy/transcode-mcp",
    result_grouping: "overlay_first",
  },
});
```

The current `src/worker.ts` does this correctly.

---

## What Strict Mode Means

When `knowledge_base_url` is set, oddkit's search corpus is the overlay (this repo) plus the required-baseline (a small subset of parent canon that every project inherits — values, axioms, writing canon). Documents not in either fall through to the bundled governance tier and the response envelope declares `governance_source: bundled`. Without strict mode, missing documents are silently filled from the full parent canon and the agent never knows the doc is missing from the project's own knowledge base.

For this project: strict mode is the right default. If a constraint or convention is missing from this repo, that is a gap to be filled in this repo — not a problem the parent canon's coverage should hide.

---

## What This Replaces

This document replaces an earlier `oddkit-mcp-config.json` file that used an envelope (`{"mcp": {"tools": [...], "knowledge_base_url": "...", "strict_mode": true}}`) no MCP client actually reads. The file looked like machine-readable config but was inert. The fix is the file you are reading: human documentation of the actual configuration each client type uses.